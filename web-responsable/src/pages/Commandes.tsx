import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { CarteVille3D } from '../composants/CarteVille3D';
import { InterventionsCommande } from '../composants/InterventionsCommande';
import { CompteurTuile, FriseEtapes, FriseTrajet, LigneCommande, Pastille, Puce } from '../composants/luxe';
import { EN_COURS, etapesCommande, heure, initiale, progression, tonStatut } from '../composants/statuts';
import { EnTete, EtatTableau, useDonnees } from '../composants/ui';
import {
  formatCreneau, formatDate, formatDistance, formatMontant, MODES_PAIEMENT, STATUTS, STATUTS_PAIEMENT, TYPES_LIVRAISON,
} from '../format';
import type { Livraison, StatutLivraison } from '../types';

type Vue = 'TOUS' | 'EN_COURS' | 'ATTENTE' | 'LIVREES' | 'ECHECS';
const VUES: Record<Vue, (l: Livraison) => boolean> = {
  TOUS: () => true,
  EN_COURS: l => EN_COURS.includes(l.statut),
  ATTENTE: l => l.statut === 'PENDING_PARTNER',
  LIVREES: l => l.statut === 'LIVREE',
  ECHECS: l => ['ECHEC', 'REFUSEE', 'ANNULEE', 'RETOURNEE'].includes(l.statut),
};

// US-07 : suivi des commandes ; US-311 : interventions depuis le panneau de detail (conception Doop « Direction 2 »)
export default function Commandes() {
  const { donnees, erreur, chargement, recharger } = useDonnees(api.livraisons);
  const [vue, setVue] = useState<Vue>('TOUS');
  const [statut, setStatut] = useState<StatutLivraison | null>(null);
  const [recherche, setRecherche] = useState('');
  const [params, setParams] = useSearchParams();
  const choisieId = Number(params.get('id')) || null;

  const commandes = useMemo(() => [...(donnees ?? [])].sort((a, b) => b.dateCreation.localeCompare(a.dateCreation)), [donnees]);
  const compte = (v: Vue) => commandes.filter(VUES[v]).length;
  const statutsPresents = useMemo(() => {
    const c: Partial<Record<StatutLivraison, number>> = {};
    for (const l of commandes.filter(VUES[vue])) c[l.statut] = (c[l.statut] ?? 0) + 1;
    return c;
  }, [commandes, vue]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return commandes.filter(l => VUES[vue](l) && (!statut || l.statut === statut)
      && (!q || [l.codeSuivi, l.clientEmail, l.adresse, l.nomPartenaire ?? ''].some(v => v?.toLowerCase().includes(q))));
  }, [commandes, vue, statut, recherche]);

  const choisie = commandes.find(l => l.id === choisieId) ?? visibles[0] ?? null;
  const choisir = (l: Livraison) => setParams(p => { p.set('id', String(l.id)); return p; }, { replace: true });
  const changerVue = (v: Vue) => { setVue(v); setStatut(null); };

  return (
    <>
      <EnTete titre="Commandes" sousTitre={`${compte('EN_COURS')} en cours · ${compte('LIVREES')} livrées · ${commandes.length} au total`}>
        <button className="bouton secondaire" onClick={() => void recharger()} disabled={chargement}>Actualiser</button>
      </EnTete>

      <div className="cmd">
        <section className="cmd-liste">
          <div className="cmd-compteurs">
            <CompteurTuile libelle="En cours" valeur={compte('EN_COURS')} actif={vue === 'EN_COURS'} onClick={() => changerVue(vue === 'EN_COURS' ? 'TOUS' : 'EN_COURS')} />
            <CompteurTuile libelle="En attente commerce" valeur={compte('ATTENTE')} actif={vue === 'ATTENTE'} onClick={() => changerVue(vue === 'ATTENTE' ? 'TOUS' : 'ATTENTE')} />
            <CompteurTuile libelle="Livrées" valeur={compte('LIVREES')} actif={vue === 'LIVREES'} onClick={() => changerVue(vue === 'LIVREES' ? 'TOUS' : 'LIVREES')} />
            <CompteurTuile libelle="Échecs et annulations" valeur={compte('ECHECS')} actif={vue === 'ECHECS'} onClick={() => changerVue(vue === 'ECHECS' ? 'TOUS' : 'ECHECS')} />
          </div>

          <div className="filtres">
            <Puce libelle="Toutes" active={!statut} onClick={() => setStatut(null)} compte={commandes.filter(VUES[vue]).length} />
            {(Object.keys(STATUTS) as StatutLivraison[]).filter(s => statutsPresents[s]).map(s => (
              <Puce key={s} libelle={STATUTS[s].libelle} active={statut === s} onClick={() => setStatut(s)} compte={statutsPresents[s]} />
            ))}
            <input className="recherche" type="search" placeholder="Code, client, commerce…" aria-label="Rechercher une commande"
              value={recherche} onChange={e => setRecherche(e.target.value)} />
          </div>

          <div className="cmd-table">
            <div className="cmd-entetes"><span /><span>Commande</span><span>Statut</span><span>Total</span></div>
            <EtatTableau chargement={chargement && !donnees} erreur={erreur} vide={visibles.length === 0}
              messageVide={commandes.length ? 'Aucune commande ne correspond.' : 'Aucune commande pour le moment.'}
              onReessayer={() => void recharger()} />
            {visibles.map((l, i) => (
              <LigneCommande key={l.id} rang={i} initiale={initiale(l)} titre={l.nomPartenaire ?? l.clientEmail} code={l.codeSuivi}
                zone={l.zoneNom ?? 'Hors zone'} heure={heure(l.dateCreation)} etat={STATUTS[l.statut].libelle} ton={tonStatut(l.statut)}
                montant={formatMontant(l.montantTotal)} choisie={choisie?.id === l.id} onClick={() => choisir(l)} />
            ))}
          </div>
        </section>

        {choisie
          ? <DetailCommande key={choisie.id} livraison={choisie} onModifiee={() => void recharger()} />
          : <aside className="cmd-detail"><div className="cmd-vide"><CarteVille3D ton="jour" /><p>Choisissez une commande pour voir son trajet.</p></div></aside>}
      </div>
    </>
  );
}

function DetailCommande({ livraison: l, onModifiee }: { livraison: Livraison; onModifiee: () => void }) {
  const carte = `https://www.openstreetmap.org/?mlat=${l.latitude}&mlon=${l.longitude}#map=16/${l.latitude}/${l.longitude}`;
  return (
    <aside className="cmd-detail" aria-label={`Commande ${l.codeSuivi}`}>
      <div className="carte-tete">
        <CarteVille3D ton="jour" />
        <div className="flottant">
          <a className="bouton-icone" href={carte} target="_blank" rel="noreferrer" aria-label="Ouvrir l’adresse sur la carte">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></svg>
          </a>
          <Pastille ton="nuit" pulse={EN_COURS.includes(l.statut)}>{STATUTS[l.statut].libelle}</Pastille>
        </div>
      </div>
      <div className="corps">
        <div className="nuit">
          <FriseTrajet depart={heure(l.creneauDebut)} arrivee={heure(l.creneauFin)} duree={formatDistance(l.distanceKm)}
            de={l.nomPartenaire ?? 'Départ'} vers={l.zoneNom ?? 'Client'} distance={l.codeSuivi} progression={progression(l.statut)} />
        </div>
        <div className="titre">
          <h2>{l.codeSuivi} · {l.nomPartenaire ?? 'Commande directe'}</h2>
          <small>{l.clientEmail} · {l.adresse}</small>
        </div>
        <div className="faits">
          <div><small>Articles</small><strong>{l.lignes?.reduce((n, x) => n + x.quantite, 0) || '—'}</strong></div>
          <div><small>Paiement</small><strong>{MODES_PAIEMENT[l.modePaiement]}</strong></div>
          <div><small>Total</small><strong>{formatMontant(l.montantTotal)}</strong></div>
        </div>
        <FriseEtapes etapes={etapesCommande(l)} />
        <details>
          <summary>Tous les détails</summary>
          <dl className="details">
            {l.nomPartenaire && <><dt>Articles</dt><dd>{l.lignes.map(ligne => <div key={ligne.produitId}>{ligne.quantite} × {ligne.nomProduit} · {formatMontant(ligne.sousTotal)}</div>)}</dd><dt>Notes</dt><dd>{l.notes || '—'}</dd></>}
            <dt>Type</dt><dd>{l.typeLivraison ? TYPES_LIVRAISON[l.typeLivraison] : '—'}</dd>
            <dt>Créneau</dt><dd>{formatCreneau(l.creneauDebut, l.creneauFin)}</dd>
            <dt>Paiement</dt><dd>{MODES_PAIEMENT[l.modePaiement]}{l.statutPaiement && <span className="discret"> · {STATUTS_PAIEMENT[l.statutPaiement]}</span>}</dd>
            <dt>Frais</dt><dd>{formatMontant(l.fraisLivraison)}</dd>
            {l.supplementImmediat > 0 && <><dt>Supplément</dt><dd>{formatMontant(l.supplementImmediat)}</dd></>}
            <dt>À collecter</dt><dd>{formatMontant(l.montantACollecter)}</dd>
            <dt>Créée le</dt><dd>{formatDate(l.dateCreation)}</dd>
            <dt>Position</dt><dd><a href={carte} target="_blank" rel="noreferrer">{l.latitude.toFixed(5)}, {l.longitude.toFixed(5)}</a></dd>
          </dl>
        </details>
        {l.partenaireId && <InterventionsCommande commandeId={l.id} onModifiee={onModifiee} />}
      </div>
    </aside>
  );
}
