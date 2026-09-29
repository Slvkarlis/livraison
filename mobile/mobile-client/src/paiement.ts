import { api, type Livraison, type PaiementConfig } from '@fleetpulse/shared';
import { initPaymentSheet, initStripe, presentPaymentSheet } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { theme } from './theme';

export type ResultatPaiement =
  | { etat: 'paye'; livraison: Livraison }
  | { etat: 'annule' }
  | { etat: 'erreur'; message: string };

let configCache: Promise<PaiementConfig> | null = null;
let stripeInitialise: string | null = null;

function chargerConfig(): Promise<PaiementConfig> {
  configCache ??= api.paiementConfig().catch((e) => {
    configCache = null;
    throw e;
  });
  return configCache;
}

/** Disponibilite du paiement par carte (cles Stripe configurees sur le serveur). */
export function usePaiementConfig(): PaiementConfig | null {
  const [config, setConfig] = useState<PaiementConfig | null>(null);
  useEffect(() => {
    let actif = true;
    chargerConfig()
      .then((c) => { if (actif) setConfig(c); })
      .catch(() => { if (actif) setConfig({ carteDisponible: false, clePublique: null, devise: 'tnd' }); });
    return () => { actif = false; };
  }, []);
  return config;
}

// Dans Expo Go, le lien de retour (3-D Secure) doit contenir "/--/" (voir la doc Expo Stripe).
function urlRetour() {
  return Constants.appOwnership === 'expo' ? Linking.createURL('/--/') : Linking.createURL('');
}

/**
 * Paiement Stripe d'une commande deja creee : le serveur fournit le client_secret (montant calcule cote serveur),
 * la PaymentSheet collecte la carte, puis le serveur verifie le resultat aupres de Stripe.
 */
export async function payerCommande(livraison: Livraison): Promise<ResultatPaiement> {
  try {
    const config = await chargerConfig();
    if (!config.carteDisponible || !config.clePublique) {
      return { etat: 'erreur', message: 'Le paiement par carte est indisponible pour le moment.' };
    }
    if (stripeInitialise !== config.clePublique) {
      await initStripe({ publishableKey: config.clePublique, urlScheme: urlRetour() });
      stripeInitialise = config.clePublique;
    }

    const paiement = await api.demarrerPaiement(livraison.id);
    if (paiement.dejaPaye || !paiement.clientSecret) {
      return { etat: 'paye', livraison: await api.verifierPaiement(livraison.id) };
    }

    const init = await initPaymentSheet({
      merchantDisplayName: 'FleetPulse',
      paymentIntentClientSecret: paiement.clientSecret,
      returnURL: urlRetour(),
      primaryButtonLabel: 'Payer la livraison',
      appearance: {
        colors: { primary: theme.accent, background: theme.surface, componentBackground: theme.fond },
        shapes: { borderRadius: 14 },
      },
    });
    if (init.error) return { etat: 'erreur', message: init.error.localizedMessage ?? init.error.message };

    const resultat = await presentPaymentSheet();
    if (resultat.error) {
      if (resultat.error.code === 'Canceled') return { etat: 'annule' };
      return { etat: 'erreur', message: resultat.error.localizedMessage ?? resultat.error.message };
    }

    const verifiee = await api.verifierPaiement(livraison.id);
    return verifiee.statutPaiement === 'PAYE'
      ? { etat: 'paye', livraison: verifiee }
      : { etat: 'erreur', message: 'Paiement en cours de validation. Réessayez dans un instant.' };
  } catch (e) {
    return { etat: 'erreur', message: e instanceof Error ? e.message : 'Paiement impossible.' };
  }
}
