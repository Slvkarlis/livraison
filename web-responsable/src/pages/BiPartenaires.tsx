import { biApi } from '../biApi';
import { EnTete, EtatTableau } from '../composants/ui';
import { FiltresBi, Indicateur } from '../composants/BiCommun';
import { useBi } from '../composants/useBi';
import { valeurBi } from '../../../mobile/packages/shared/src/bi';

export default function BiPartenaires() {
  const b = useBi(biApi.partenaires), d = b.donnees;
  return <div className="bi-page"><EnTete titre="BI Partenaires" sousTitre="Préparation, décisions et classement des commerces." />
    <FiltresBi debut={b.debut} fin={b.fin} onDebut={b.setDebut} onFin={b.setFin} chargement={b.chargement} onValider={b.appliquer} />
    <EtatTableau chargement={b.chargement} erreur={b.erreur} vide={!d?.partenaires.length} messageVide="Aucun partenaire avec des commandes sur cette période." onReessayer={() => void b.recharger()} />
    {d && !b.chargement && !b.erreur && <>
      <p role="status">Commandes créées du {d.periode.debut} au {d.periode.fin}.</p>
      <div className="bi-table"><table><caption>Préparation et qualité</caption><thead><tr><th>Rang</th><th>Commerce</th><th>Commandes</th><th>Acceptation</th><th>Refus</th><th>Préparation annoncée / réelle</th><th>Note moyenne</th><th>Motifs de refus</th></tr></thead><tbody>
        {d.partenaires.map(p => <tr key={p.id}><td>{p.classement ?? 'Sans note'}</td><td>{p.nomCommerce}</td><td>{p.commandes}</td><td>{valeurBi(p.tauxAcceptation, ' %')} ({p.acceptees})</td><td>{valeurBi(p.tauxRefus, ' %')} ({p.refusees})</td><td>{valeurBi(p.preparationEstimeeMinutes, ' min')} / {valeurBi(p.preparationReelleMinutes, ' min')} · {p.preparationsMesurees} mesures</td><td>{valeurBi(p.noteMoyenne, ' / 5')} · {p.nombreNotes} avis</td><td>{p.motifs.map(m => `${m.motif} : ${m.commandes}`).join(', ') || 'Aucun refus'}</td></tr>)}
      </tbody></table></div>
      <p className="bi-legende">Acceptation / refus : décisions prises parmi ces commandes ; en attente et annulations sans décision exclues du dénominateur. Préparation : moyenne annoncée vs acceptation → prêt sur les mêmes commandes avec horodatages valides et durée annoncée. Notes : tous les avis clients sur ces commandes. Classement : moyenne décroissante, puis nombre d’avis, puis identifiant.</p>
      <div className="bi-grille"><Indicateur titre="Taux d’expiration" valeur={null} legende="Non disponible : l’expiration partenaire à deux minutes a été abandonnée (US-2B3)." /><Indicateur titre="Réclamations" valeur={null} legende="Non disponible : l’entité réclamation sera introduite au Sprint 7." /></div>
    </>}
  </div>;
}
