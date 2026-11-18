import { api } from '../api';
import { biApi } from '../biApi';
import { EnTete, EtatTableau, useDonnees } from '../composants/ui';
import { FiltresBi } from '../composants/BiCommun';
import { useBi } from '../composants/useBi';
import { valeurBi } from '../../../mobile/packages/shared/src/bi';

export default function BiCoursiers() {
  const b = useBi(biApi.coursiers), d = b.donnees;
  const { donnees: zones } = useDonnees(api.zones);
  return <div className="bi-page"><EnTete titre="BI Coursiers et zones" sousTitre="Trajets, promesses de livraison et régularité des dépôts." />
    <FiltresBi debut={b.debut} fin={b.fin} onDebut={b.setDebut} onFin={b.setFin} chargement={b.chargement} onValider={b.appliquer}>
      <label className="champ">Zone<select value={b.zone} onChange={e => b.setZone(e.target.value)}><option value="">Toutes les zones</option>{zones?.map(z => <option key={z.id} value={z.id}>{z.nom}</option>)}</select></label>
    </FiltresBi>
    <EtatTableau chargement={b.chargement} erreur={b.erreur} vide={!d?.coursiers.length} messageVide="Aucune mission livrée comptabilisée sur cette période." onReessayer={() => void b.recharger()} />
    {d && !b.chargement && !b.erreur && <>
      <p role="status">Livraisons comptabilisées du {d.periode.debut} au {d.periode.fin}.</p>
      <div className="bi-table"><table><caption>Performance des coursiers</caption><thead><tr><th>Coursier</th><th>Missions</th><th>Min / km estimé</th><th>ETA respectés</th><th>Délai dépôt</th><th>Non déposées</th><th>Écarts dépôt</th><th>Note</th></tr></thead><tbody>
        {d.coursiers.map(c => <tr key={c.id}><td>Coursier #{c.id}</td><td>{c.missions}</td><td>{valeurBi(c.minutesParKm)} · {c.trajetsMesures} mesures</td><td>{valeurBi(c.respectEtaPourcent, ' %')} ({c.etaRespectes}/{c.etaMesurables})</td><td>{valeurBi(c.delaiDepotHeures, ' h')} · {c.depotsMesures} missions</td><td>{c.missionsNonDeposees}</td><td>{c.ecartsDepot}</td><td>{valeurBi(c.noteMoyenne, '/5')} · {c.nombreNotes} avis</td></tr>)}
      </tbody></table></div>
      <p className="bi-legende">Min/km = somme des minutes collecte → livraison / somme des distances estimées figées pour ces missions (distance commerce → client × détour 1,3). Ce ratio ne mesure pas la distance GPS réelle. Les trajets sans durée valide ou distance positive sont exclus. ETA : livraison au plus tard à la promesse, parmi les commandes avec promesse.</p>
      <p className="bi-legende">Dépôt : délai moyen livraison → reçu, pondéré par mission rapprochée, hors commandes non déposées. Écarts : nombre d’écritures ECART_DEPOT datées de la période, sans montant financier ; avec filtre de zone, un dépôt mixte compte s’il contient une commande de la zone. Notes clients et partenaires : même poids, sur les missions livrées de la période.</p>
      <div className="bi-table"><table><caption>Productivité par zone figée à la comptabilisation</caption><thead><tr><th>Zone</th><th>Livraisons</th><th>Coursiers distincts</th><th>Km estimés</th><th>Livraisons / jour</th><th>Missions / coursier</th></tr></thead><tbody>
        {d.zones.map(z => <tr key={z.id ?? 'sans-zone'}><td>{z.nom}</td><td>{z.livraisons}</td><td>{z.coursiers}</td><td>{valeurBi(z.distanceEstimeeKm)}</td><td>{valeurBi(z.livraisonsParJour)}</td><td>{valeurBi(z.missionsParCoursier)}</td></tr>)}
      </tbody></table></div>
      <p className="bi-legende">Livraisons/jour : toutes les dates civiles de la période sont incluses. Missions/coursier : livraisons / nombre de coursiers distincts ayant livré dans la zone.</p>
    </>}
  </div>;
}
