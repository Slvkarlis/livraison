import { useCallback, useState } from 'react';
import { api } from '../api';
import { biApi } from '../biApi';
import { EnTete, EtatTableau, useDonnees } from '../composants/ui';
import { FiltresBi, Indicateur } from '../composants/BiCommun';
import CarteDensite from '../composants/CarteDensite';
import CockpitAlertes from '../composants/CockpitAlertes';
import { filtreBi, periodeParDefaut, valeurBi } from '../../../mobile/packages/shared/src/bi';
import { STATUTS } from '../../../mobile/packages/shared/src/format';

export default function BiOperations() {
  const initial = periodeParDefaut();
  const [debut, setDebut] = useState(initial.debut), [fin, setFin] = useState(initial.fin), [zone, setZone] = useState('');
  const [query, setQuery] = useState(filtreBi(initial.debut, initial.fin));
  const { donnees: zones } = useDonnees(api.zones);
  const charger = useCallback(() => biApi.operations(query), [query]);
  const { donnees: d, erreur, chargement, recharger } = useDonnees(charger);
  return <div className="bi-page"><EnTete titre="BI Opérations" sousTitre="Volume, densité et couverture actuelle des zones." />
    <CockpitAlertes />
    <FiltresBi debut={debut} fin={fin} onDebut={setDebut} onFin={setFin} chargement={chargement} onValider={() => {
      const q = filtreBi(debut, fin, zone); if (q === query) void recharger(); else setQuery(q);
    }}><label className="champ">Zone<select value={zone} onChange={e => setZone(e.target.value)}><option value="">Toutes les zones</option>{zones?.map(z => <option key={z.id} value={z.id}>{z.nom}</option>)}</select></label></FiltresBi>
    <EtatTableau chargement={chargement} erreur={erreur} vide={false} messageVide="Aucune commande sur cette période." onReessayer={() => void recharger()} />
    {d && !erreur && !chargement && <>
      <p role="status">Période : {d.periode.debut} → {d.periode.fin}. {d.statuts.every(s => s.commandes === 0) ? 'Aucune commande créée sur la période.' : ''}</p>
      <div className="bi-grille">{d.statuts.filter(s => s.commandes > 0).map(s => <Indicateur key={s.statut} titre={STATUTS[s.statut as keyof typeof STATUTS]?.libelle ?? s.statut} valeur={s.commandes} legende="Statut actuel des commandes créées dans la période ; zone actuelle du commerce." />)}</div>
      <CarteDensite zones={d.zones} />
      <div className="bi-table"><table><caption>Couverture observée maintenant</caption><thead><tr><th>Zone</th><th>Commandes période</th><th>Livrées</th><th>Actives maintenant</th><th>Coursiers disponibles</th><th>Couverture</th></tr></thead><tbody>
        {d.zones.map(z => <tr key={z.id}><td>{z.nom}</td><td>{z.commandes}</td><td>{z.livrees}</td><td>{z.commandesActives}</td><td>{z.coursiersDisponibles}</td><td>{valeurBi(z.couverturePourcent, ' %')}</td></tr>)}
      </tbody></table>{!d.zones.length && <p>Aucune zone dans ce filtre.</p>}</div>
      <p className="bi-legende">Couverture = 100 × coursiers actifs déclarés disponibles avec une affectation en vigueur / commandes actives. Sans commande active : non disponible. Un coursier affecté à plusieurs zones peut compter dans chacune. La période filtre les volumes ; les disponibilités et commandes actives sont observées maintenant.</p>
      <div className="bi-grille"><Indicateur titre="Distance économisée par les lots" valeur={d.gainDistanceKm} unite=" km" legende={d.indisponibiliteGains} /><Indicateur titre="Temps économisé par les lots" valeur={d.gainTempsMinutes} unite=" min" legende={d.indisponibiliteGains} /></div>
    </>}
  </div>;
}
