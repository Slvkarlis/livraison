import Ionicons from '@expo/vector-icons/Ionicons';
import { DUREE_BANDEAU_MS, api, surDeconnexion, useNotificationsTempsReel, type NotificationCommande } from '@fleetpulse/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { ecouterTouches, enregistrerPush } from './pushNatif';

function ouvrirCommande(commandeId: number) {
  router.push(`/commande/${commandeId}`);
}

/**
 * US-304 : pour le client connecte,
 * - enregistre le telephone pour le push (retire a la deconnexion) et ouvre la commande quand une notification est touchee ;
 * - affiche un bandeau a chaque notification recue en temps reel, application ouverte (toutes plateformes, web compris).
 */
export function NotificationsClient({ actif }: { actif: boolean }) {
  const [bandeau, setBandeau] = useState<NotificationCommande | null>(null);
  const haut = useSafeAreaInsets().top;

  useEffect(() => {
    if (!actif) return;
    let jeton: string | null = null;
    let annule = false;
    void enregistrerPush().then(async (j) => {
      if (!j || annule) return;
      await api.enregistrerAppareil(j);
      jeton = j;
    }).catch(() => {});
    const retirer = surDeconnexion(async () => { if (jeton) await api.retirerAppareil(jeton); });
    const touches = ecouterTouches(ouvrirCommande, () => router.push('/nouvelle-commande'));
    return () => { annule = true; retirer(); touches(); };
  }, [actif]);

  useNotificationsTempsReel((n) => setBandeau(n));
  useEffect(() => {
    if (!bandeau) return;
    const minuterie = setTimeout(() => setBandeau(null), DUREE_BANDEAU_MS);
    return () => clearTimeout(minuterie);
  }, [bandeau]);

  if (!actif || !bandeau) return null;
  const commandeId = bandeau.commandeId;
  return (
    <View pointerEvents="box-none" style={[styles.conteneur, { top: haut + 8 }]}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={`${bandeau.titre}. ${bandeau.message}`}
        style={styles.bandeau}
        onPress={() => { setBandeau(null); if (commandeId) ouvrirCommande(commandeId); else if (bandeau.titre === 'Livraison de quartier') router.push('/nouvelle-commande'); }}
      >
        <Ionicons name="notifications" size={22} color={theme.accent} />
        <View style={styles.textes}>
          <Text style={styles.titre} numberOfLines={1}>{bandeau.titre}</Text>
          <Text style={styles.message} numberOfLines={3}>{bandeau.message}</Text>
        </View>
        <Pressable accessibilityLabel="Fermer" hitSlop={12} onPress={() => setBandeau(null)}>
          <Ionicons name="close" size={20} color={theme.secondaire} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { position: 'absolute', left: 12, right: 12, zIndex: 1000, alignItems: 'center' },
  bandeau: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.bordure,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  textes: { flex: 1, gap: 2 },
  titre: { fontSize: 15, fontWeight: '800', color: theme.texte },
  message: { fontSize: 14, color: theme.secondaire, lineHeight: 19 },
});
