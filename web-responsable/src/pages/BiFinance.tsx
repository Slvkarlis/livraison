import { useCallback, useState } from 'react';
import { biApi } from '../biApi';
import { EnTete, EtatTableau, useDonnees } from '../composants/ui';
import { FiltresBi, Indicateur } from '../composants/BiCommun';
import { filtreBi, periodeParDefaut } from '../../../mobile/packages/shared/src/bi';
import CockpitAlertes from '../composants/CockpitAlertes';

export default function BiFinance() {
  const initial = periodeParDefaut();
  const [debut, setDebut] = useState(initial.debut), [fin, setFin] = useState(initial.fin);
  const [query, setQuery] = useState(filtreBi(initial.debut, initial.fin));
  const charger = useCallback(() => biApi.finance(query), [query]);
  const { donnees: d, erreur, chargement, recharger } = useDonnees(charger);
  return <div className="bi-page"><EnTete titre="BI Finance" sousTitre="Les flux du ledger et l’état actuel des encaissements et des paiements." />
    <CockpitAlertes finance />
    <FiltresBi debut={debut} fin={fin} onDebut={setDebut} onFin={setFin} chargement={chargement} onValider={() => {
      const q = filtreBi(debut, fin); if (q === query) void recharger(); else setQuery(q);
    }} />
    <EtatTableau chargement={chargement} erreur={erreur} vide={false} messageVide="Aucune écriture sur la période." onReessayer={() => void recharger()} />
    {d && !chargement && !erreur && <>
      <p role="status">Résultats du {d.periode.debut} au {d.periode.fin}. {d.gmv === 0 ? 'Aucune vente comptabilisée sur cette période.' : ''}</p>
      <div className="bi-grille">
        <Indicateur titre="GMV / ventes d’articles" valeur={d.gmv} unite=" DT" legende="Somme GMV du ledger, par date d’écriture. Dans ce projet, le GMV exclut les frais de livraison." />
        <Indicateur titre="Articles livrés" valeur={d.articlesVendus} legende="Somme des quantités des lignes des commandes LIVREE, par date de livraison." />
        <Indicateur titre="Commissions nettes" valeur={d.commissionsNettes} unite=" DT" legende="Somme COMMISSION du ledger. Aucun remboursement de commission n’existe avant le Sprint 7." />
        <Indicateur titre="Marge de livraison" valeur={d.margeLivraison} unite=" DT" legende="FRAIS_LIVRAISON − REMUNERATION_COURSIER du ledger, par date d’écriture. Peut être négative." />
        <Indicateur titre="Cash en circulation" valeur={d.cashEnCirculation} unite=" DT" legende="État actuel : cash des livraisons de la période encore sans dépôt. Une période passée ne reconstitue pas un solde historique." />
        <Indicateur titre="Reversements à effectuer" valeur={d.reversementsAEffectuer} unite=" DT" legende="État actuel : net partenaire des livraisons de la période dont le cash est rapproché, sans closing partenaire." />
        <Indicateur titre="Rémunérations à effectuer" valeur={d.remunerationsAEffectuer} unite=" DT" legende="État actuel : rémunération des missions livrées sur la période, sans closing coursier." />
        <Indicateur titre="Reversements enregistrés" valeur={d.reversementsEffectues} unite=" DT" legende="Somme REVERSEMENT_PARTENAIRE, par date d’écriture du closing. Paiement enregistré, sans exécution bancaire." />
        <Indicateur titre="Rémunérations enregistrées" valeur={d.remunerationsEffectuees} unite=" DT" legende="Somme PAIEMENT_COURSIER, par date d’écriture du closing." />
      </div>
    </>}
  </div>;
}
