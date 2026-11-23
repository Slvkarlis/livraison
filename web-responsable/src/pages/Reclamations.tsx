import { useState } from 'react';
import { api, type ReclamationVue } from '../api';
import { Alerte, EnTete, EtatTableau, Modale, useDonnees } from '../composants/ui';
import { formatMontant } from '../format';

const IMPUTATIONS = [
  { valeur: 'PARTENAIRE', libelle: 'Le commerce' },
  { valeur: 'COURSIER', libelle: 'Le coursier' },
  { valeur: 'RESPONSABLE', libelle: 'FleetPulse' },
];

export default function Reclamations() {
  const { donnees, erreur, chargement, recharger } = useDonnees(api.reclamations);
  const [cible, setCible] = useState<ReclamationVue | null>(null);
  const [montant, setMontant] = useState('');
  const [imputation, setImputation] = useState('PARTENAIRE');
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);

  function ouvrir(r: ReclamationVue) {
    setCible(r);
    setMontant(String(r.montantDemande));
    setImputation('PARTENAIRE');
    setCommentaire('');
    setEchec(null);
  }

  async function decider(rejet: boolean) {
    if (!cible) return;
    setEnvoi(true);
    setEchec(null);
    try {
      await api.decisionReclamation(cible.id, rejet ? 0 : Number(montant), rejet ? null : imputation, commentaire);
      setCible(null);
      await recharger();
    } catch (e) {
      setEchec((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <EnTete titre="Réclamations clients" sousTitre="Remboursements et imputations. Chaque décision produit ses écritures au ledger.">
        <button className="bouton secondaire" disabled={chargement} onClick={() => void recharger()}>Actualiser</button>
      </EnTete>
      <div className="carte">
        <EtatTableau chargement={chargement} erreur={erreur} vide={!donnees?.length} messageVide="Aucune réclamation à traiter." onReessayer={() => void recharger()} />
        {!!donnees?.length && (
          <table>
            <thead><tr><th>Commande</th><th>Type</th><th>Description</th><th>Montant demandé</th><th></th></tr></thead>
            <tbody>
              {donnees.map(r => (
                <tr key={r.id}>
                  <td className="mono">{r.codeSuivi}</td>
                  <td>{r.type}</td>
                  <td>{r.description}</td>
                  <td>{formatMontant(r.montantDemande)}</td>
                  <td><button className="bouton-lien" onClick={() => ouvrir(r)}>Traiter</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {cible && (
        <Modale titre={`Traiter · ${cible.codeSuivi}`} onFermer={() => { if (!envoi) setCible(null); }}>
          <form className="formulaire" onSubmit={e => { e.preventDefault(); void decider(false); }}>
            {echec && <Alerte message={echec} />}
            <label className="champ">Montant à rembourser (DT)
              <input type="number" min="0" step="0.001" value={montant} disabled={envoi} onChange={e => setMontant(e.target.value)} />
            </label>
            <label className="champ">Imputé à
              <select value={imputation} disabled={envoi} onChange={e => setImputation(e.target.value)}>
                {IMPUTATIONS.map(i => <option key={i.valeur} value={i.valeur}>{i.libelle}</option>)}
              </select>
            </label>
            <label className="champ">Commentaire
              <textarea value={commentaire} rows={3} disabled={envoi} onChange={e => setCommentaire(e.target.value)} />
            </label>
            <div className="pied-modale">
              <button className="bouton secondaire" type="button" disabled={envoi} onClick={() => void decider(true)}>Rejeter</button>
              <button className="bouton" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Rembourser'}</button>
            </div>
          </form>
        </Modale>
      )}
    </>
  );
}
