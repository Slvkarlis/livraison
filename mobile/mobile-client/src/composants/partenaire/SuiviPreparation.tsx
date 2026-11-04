import {
  AJUSTEMENTS_PREPARATION_MAX,
  Bouton,
  Carte,
  Champ,
  MessageErreur,
  TEMPS_PREPARATION_PROPOSES,
  api,
  verifierTempsPreparation,
  type CommandeDetail,
} from '@fleetpulse/shared';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';
import { Puce } from './Puce';

// US-2B4 / US-2B5 : debut de preparation, nouveau delai (au plus 2 fois), commande prete
export function SuiviPreparation({ commande, onMaj }: {
  commande: CommandeDetail;
  onMaj: (maj: CommandeDetail, message: string) => void;
}) {
  const [panneau, setPanneau] = useState<'actions' | 'ajuster' | 'prete'>('actions');
  const [temps, setTemps] = useState<number | 'autre'>(10);
  const [tempsSaisi, setTempsSaisi] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const restants = Math.max(0, AJUSTEMENTS_PREPARATION_MAX - commande.nbAjustementsPreparation);
  const enPreparation = commande.statut === 'EN_PREPARATION';

  async function executer(action: () => Promise<CommandeDetail>, message: string) {
    setEnvoi(true);
    setErreur(null);
    try {
      onMaj(await action(), message);
      setPanneau('actions');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  function ajuster() {
    const invalide = temps === 'autre' ? verifierTempsPreparation(tempsSaisi) : null;
    if (invalide) { setErreur(invalide); return; }
    const minutes = temps === 'autre' ? Number(tempsSaisi.trim()) : temps;
    void executer(() => api.ajusterPreparation(commande.id, minutes), `Nouveau délai annoncé au client : encore ${minutes} min.`);
  }

  if (panneau === 'ajuster') {
    return (
      <Carte>
        <Text style={styles.titre}>Nouveau délai</Text>
        <Text style={styles.aide}>Temps restant à partir de maintenant · {restants} ajustement{restants > 1 ? 's' : ''} possible{restants > 1 ? 's' : ''}</Text>
        <View style={styles.choix}>
          {TEMPS_PREPARATION_PROPOSES.map((t) => (
            <Puce key={t} libelle={`encore ${t} min`} actif={temps === t} desactive={envoi} onPress={() => setTemps(t)} />
          ))}
          <Puce libelle="Autre" actif={temps === 'autre'} desactive={envoi} onPress={() => setTemps('autre')} />
        </View>
        {temps === 'autre' ? (
          <Champ libelle="Minutes restantes (1 à 180)" value={tempsSaisi} onChangeText={setTempsSaisi} keyboardType="number-pad" maxLength={3} editable={!envoi} />
        ) : null}
        <MessageErreur message={erreur} />
        <Bouton titre="Annoncer ce nouveau délai" chargement={envoi} onPress={ajuster} style={styles.bouton} />
        <Bouton titre="Annuler" variante="discret" desactive={envoi} onPress={() => { setPanneau('actions'); setErreur(null); }} />
      </Carte>
    );
  }

  if (panneau === 'prete') {
    return (
      <Carte>
        <Text style={styles.titre}>Commande prête ?</Text>
        <Text style={styles.aide}>Confirmez quand la commande est emballée et prête à être récupérée par le livreur.</Text>
        <MessageErreur message={erreur} />
        <Bouton
          titre="Oui, commande prête"
          chargement={envoi}
          onPress={() => void executer(() => api.marquerPrete(commande.id), 'Commande prête : le livreur peut venir la récupérer.')}
          style={styles.bouton}
        />
        <Bouton titre="Pas encore" variante="discret" desactive={envoi} onPress={() => { setPanneau('actions'); setErreur(null); }} />
      </Carte>
    );
  }

  return (
    <Carte>
      <Text style={styles.titre}>Préparation</Text>
      <Text style={styles.aide}>{enPreparation ? 'En cours de préparation.' : 'Commande acceptée, préparation pas encore commencée.'}</Text>
      <MessageErreur message={erreur} />
      {!enPreparation ? (
        <Bouton
          titre="Commencer la préparation"
          chargement={envoi}
          onPress={() => void executer(() => api.commencerPreparation(commande.id), 'Préparation commencée.')}
          style={styles.bouton}
        />
      ) : null}
      <Bouton
        titre="Commande prête"
        variante={enPreparation ? 'primaire' : 'secondaire'}
        desactive={envoi}
        onPress={() => { setPanneau('prete'); setErreur(null); }}
        style={styles.bouton}
      />
      <Bouton
        titre={restants > 0 ? `Ajuster le délai (${restants} restant${restants > 1 ? 's' : ''})` : 'Délai déjà ajusté 2 fois'}
        variante="discret"
        desactive={envoi || restants === 0}
        onPress={() => { setPanneau('ajuster'); setErreur(null); }}
      />
    </Carte>
  );
}

const styles = StyleSheet.create({
  titre: { fontSize: 17, fontWeight: '700', color: theme.texte },
  aide: { fontSize: 14, color: theme.secondaire, marginTop: 4, marginBottom: 12 },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  bouton: { marginTop: 8 },
});
