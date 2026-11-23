import { useState } from 'react';
import { api, type EchecVue } from '../api';
import { Chiffre, StatHero, StatTuile } from '../composants/luxe';
import { Alerte, EnTete, EtatTableau, Modale, useDonnees } from '../composants/ui';

const DECISIONS = [
  { valeur: 'RELIVRAISON', libelle: 'Relivrer' },
  { valeur: 'RETOUR_PARTENAIRE', libelle: 'Retourner au commerce' },
  { valeur: 'PERTE', libelle: 'Déclarer perdue' },
];

export default function Echecs() {
  const { donnees, erreur, chargement, recharger } = useDonnees(api.echecs);
  const [cible, setCible] = useState<EchecVue | null>(null);
  const [decision, setDecision] = useState('RELIVRAISON');
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const aTraiter = (donnees ?? []).filter(e => !e.decision).length;

  async function decider() {
    if (!cible) return;
    setEnvoi(true);
    setEchec(null);
    try {
      await api.decisionEchec(cible.id, decision, commentaire);
      setCible(null);
      setCommentaire('');
      await recharger();
    } catch (e) {
      setEchec((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <EnTete titre="Échecs de livraison" sousTitre={`${aTraiter} échec${aTraiter > 1 ? 's' : ''} en attente de décision`}>
        <button className="bouton secondaire" disabled={chargement} onClick={() => void recharger()}>Actualiser</button>
      </EnTete>
      {donnees && <div className="bande-vedette">
        <StatHero legende="Échecs à décider" valeur={<Chiffre valeur={aTraiter} />} pastille="Relivraison · retour · perte"
          note={<><b>{donnees.length}</b> échec{donnees.length > 1 ? 's' : ''} déclaré{donnees.length > 1 ? 's' : ''} au total</>} />
        <StatTuile legende="Décidés" valeur={<Chiffre valeur={donnees.length - aTraiter} />} note="avec écritures au ledger" delta="Traçables" ton="succes" />
        <StatTuile legende="Motif fréquent" valeur={motifFrequent(donnees.map(e => e.motif))} note="sur l’ensemble des déclarations" ton="danger" delta="À surveiller" />
      </div>}
      <div className="carte">
        <EtatTableau chargement={chargement} erreur={erreur} vide={!donnees?.length} messageVide="Aucun échec déclaré." onReessayer={() => void recharger()} />
        {!!donnees?.length && (
          <table>
            <thead><tr><th>Commande</th><th>Commerce</th><th>Zone</th><th>Motif</th><th>Décision</th><th></th></tr></thead>
            <tbody>
              {donnees.map(e => (
                <tr key={e.id}>
                  <td className="mono">{e.codeSuivi}</td>
                  <td>{e.nomCommerce}</td>
                  <td>{e.nomZone}</td>
                  <td>{e.motif}{e.commentaire ? <small className="discret"> · {e.commentaire}</small> : null}</td>
                  <td>{e.decision ? <span className="etat">{e.decision}</span> : <span className="discret">À décider</span>}</td>
                  <td>
                    {!e.decision && (
                      <button className="bouton-lien" onClick={() => { setCible(e); setDecision('RELIVRAISON'); setEchec(null); }}>Décider</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {cible && (
        <Modale titre={`Décision · ${cible.codeSuivi}`} onFermer={() => { if (!envoi) setCible(null); }}>
          <form className="formulaire" onSubmit={e => { e.preventDefault(); void decider(); }}>
            {echec && <Alerte message={echec} />}
            <label className="champ">Décision
              <select value={decision} disabled={envoi} onChange={e => setDecision(e.target.value)}>
                {DECISIONS.map(d => <option key={d.valeur} value={d.valeur}>{d.libelle}</option>)}
              </select>
            </label>
            <label className="champ">Commentaire
              <textarea value={commentaire} rows={3} disabled={envoi} onChange={e => setCommentaire(e.target.value)} />
            </label>
            <div className="pied-modale">
              <button className="bouton" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer la décision'}</button>
            </div>
          </form>
        </Modale>
      )}
    </>
  );
}

function motifFrequent(motifs: string[]): string {
  const n = motifs.reduce<Record<string, number>>((a, m) => { a[m] = (a[m] ?? 0) + 1; return a; }, {});
  const [m] = Object.entries(n).sort((a, b) => b[1] - a[1])[0] ?? ['—'];
  return m.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
}
