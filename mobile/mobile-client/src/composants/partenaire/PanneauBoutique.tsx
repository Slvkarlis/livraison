import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, api, useTheme } from '@fleetpulse/shared';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ErreurPartenaire, useRessourcePartenaire } from './InterfacePartenaire';
import { Puce } from './Puce';
import { InterrupteurPartenaire } from './InterrupteurPartenaire';

export function PanneauBoutique({ compact = false }: { compact?: boolean }) {
  const t = useTheme();
  const lire = useCallback(async () => ({ boutique: await api.boutique(), commerce: await api.commerce() }), []);
  const r = useRessourcePartenaire(lire);
  const [erreurAction, setErreurAction] = useState<string | null>(null), [envoi, setEnvoi] = useState(false);
  const verrou = useRef(false);
  const etat = r.donnees?.boutique, commerce = r.donnees?.commerce;
  const pause = !!etat?.pauseJusqua && !etat.acceptePourCommandes;
  async function executer(faire: () => Promise<unknown>) {
    if (verrou.current) return;
    verrou.current = true; setEnvoi(true); setErreurAction(null);
    try { await faire(); await r.charger(); }
    catch (e) { setErreurAction(e instanceof Error ? e.message : 'Modification impossible. Réessayez.'); }
    finally { verrou.current = false; setEnvoi(false); }
  }
  return <View style={{ backgroundColor: t.surface, borderRadius: 22, padding: 16, gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Ionicons name="storefront-outline" size={24} color={t.texte} />
      <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
        <Text style={{ color: t.texte, fontSize: 17, fontWeight: '800' }}>{!etat ? 'État de la boutique…' : etat.acceptePourCommandes ? 'Ouvert · prêt à recevoir' : pause ? 'Commandes en pause' : 'Boutique fermée'}</Text>
        <Text style={{ color: t.texte, fontSize: 13, marginTop: 3 }}>{commerce?.nomCommerce ?? 'Votre commerce'}</Text>
      </View>
      <InterrupteurPartenaire libelle="Ouvrir ou fermer le commerce" valeur={commerce?.ouvert ?? false} desactive={envoi || !commerce || (!commerce.ouvert && !commerce.zoneId)} onChanger={ouvert => void executer(() => api.ouverture(ouvert))} />
    </View>
    {commerce && !commerce.ouvert && !commerce.zoneId ? <Text style={{ color: t.erreur }}>Une zone est nécessaire pour ouvrir. Contactez votre responsable.</Text> : null}
    {pause ? <><Text style={{ color: t.texte }}>Reprise automatique à {new Date(etat!.pauseJusqua!).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis', hour: '2-digit', minute: '2-digit' })}</Text><Bouton titre="Reprendre les commandes" desactive={envoi} onPress={() => void executer(() => api.reprendreBoutique())} /></> : etat?.acceptePourCommandes && !compact ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{[15, 30, 60].map(minutes => <Puce key={minutes} libelle={`Pause ${minutes === 60 ? '1 h' : `${minutes} min`}`} actif={false} desactive={envoi} onPress={() => void executer(() => api.pauseBoutique(minutes))} />)}</ScrollView> : null}
    {etat && etat.expirationsConsecutives > 0 ? <Text style={{ color: t.erreur }}>{etat.expirationsConsecutives} commande(s) sans réponse. Une pause automatique peut s’appliquer.</Text> : null}
    <ErreurPartenaire message={r.erreur ?? erreurAction} horsConnexion={r.horsConnexion} reessayer={() => { setErreurAction(null); void r.charger(); }} />
  </View>;
}
