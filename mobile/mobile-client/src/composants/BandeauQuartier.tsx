import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { api, Pressionnable, useNotificationsTempsReel, type GroupeQuartierProche } from '@fleetpulse/shared';

/** L'adresse choisie prime ; sur l'accueil on utilise la première adresse enregistrée. */
export function BandeauQuartier({ adresseId, commerceId }: { adresseId?: number | null; commerceId?: number }) {
  const [groupes, setGroupes] = useState<GroupeQuartierProche[]>([]);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(async () => {
    try {
      const adresse = adresseId === null ? null : adresseId ?? (await api.adresses())[0]?.id;
      setGroupes(adresse ? await api.groupesQuartierProches(adresse) : []); setErreur(null);
    } catch (e) { setErreur((e as Error).message); }
  }, [adresseId]);
  useFocusEffect(useCallback(() => {
    void charger(); const rafraichir = setInterval(() => void charger(), 15000);
    const compte = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => { clearInterval(rafraichir); clearInterval(compte); };
  }, [charger]));
  useNotificationsTempsReel(() => { void charger(); });
  const accessibles = groupes.filter(g => (!commerceId || g.commerceId === commerceId) && Date.parse(g.expiration) > maintenant);
  if (adresseId === null || (!accessibles.length && !erreur)) return null;
  return <View style={{ gap: 8, marginVertical: 12 }}>
    {erreur ? <Pressionnable onPress={() => void charger()} accessibilityRole="button"><Text style={{ color: '#6D28D9' }}>Quartier indisponible · Réessayer</Text></Pressionnable> : null}
    {accessibles.map(g => {
      const secondes = Math.max(0, Math.ceil((Date.parse(g.expiration) - maintenant) / 1000));
      return <Pressionnable key={g.id} accessibilityRole="button" onPress={() => router.push('/nouvelle-commande')}
        style={{ backgroundColor: '#EDE9FE', borderColor: '#C4B5FD', borderWidth: 1, borderRadius: 18, padding: 16, gap: 5 }}>
        <Text style={{ color: '#5B21B6', fontWeight: '800', fontSize: 17 }}>Livraison de quartier</Text>
        <Text style={{ color: '#4C1D95' }}>{g.commerce} · {g.nbMembres} voisin{g.nbMembres > 1 ? 's' : ''}</Text>
        <Text style={{ color: '#6D28D9', fontWeight: '700' }}>{g.reduction === 1 ? 'Livraison gratuite' : `Livraison −${Math.round(g.reduction * 100)} %`} · {Math.floor(secondes / 60)}:{String(secondes % 60).padStart(2, '0')} restantes</Text>
      </Pressionnable>;
    })}
  </View>;
}
