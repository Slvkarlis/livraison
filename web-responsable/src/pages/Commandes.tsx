import { useMemo, useState } from 'react';
import { api } from '../api';
import { Badge, EnTete, EtatTableau, Modale, useDonnees } from '../composants/ui';
import {
  formatCreneau, formatDate, formatDistance, formatMontant, MODES_PAIEMENT, STATUTS, STATUTS_PAIEMENT,
  TYPES_LIVRAISON,
} from '../format';
import type { Livraison, StatutLivraison } from '../types';

// US-07 : liste des commandes pour suivre leur etat
export default function Commandes() {
  const { donnees, erreur, chargement, recharger } = useDonnees(api.livraisons);
  const [filtre, setFiltre] = useState<StatutLivraison | 'TOUS'>('TOUS');
  const [recherche, setRecherche] = useState('');
  const [detail, setDetail] = useState<Livraison | null>(null);

  const commandes = useMemo(
    () => [...(donnees ?? [])].sort((a, b) => b.dateCreation.localeCompare(a.dateCreation)),
    [donnees],
  );

  const compteurs = useMemo(() => {
    const c: Partial<Record<StatutLivraison, number>> = {};
    for (const l of commandes) c[l.statut] = (c[l.statut] ?? 0) + 1;
    return c;
  }, [commandes]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return commandes.filter((l) => (filtre === 'TOUS' || l.statut === filtre)
      && (!q || [l.codeSuivi, l.clientEmail, l.adresse].some((v) => v?.toLowerCase().includes(q))));
  }, [commandes, filtre, recherche]);

  return (
    <>
      <EnTete titre="Commandes" sousTitre={`${commandes.length} commande${commandes.length > 1 ? 's' : ''} au total`}>
        <button className="bouton secondaire" onClick={() => void recharger()} disabled={chargement}>Actualiser</button>
      </EnTete>

      <div className="filtres">
        <button className={`puce ${filtre === 'TOUS' ? 'active' : ''}`} onClick={() => setFiltre('TOUS')}>
          Toutes <span>{commandes.length}</span>
        </button>
        {(Object.keys(STATUTS) as StatutLivraison[]).filter((s) => compteurs[s]).map((s) => (
          <button key={s} className={`puce ${filtre === s ? 'active' : ''}`} onClick={() => setFiltre(s)}>
            {STATUTS[s].libelle} <span>{compteurs[s]}</span>
          </button>
        ))}
        <input className="recherche" type="search" placeholder="Rechercher code, client, adresse…"
          value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      </div>

      <div className="carte">
        <EtatTableau chargement={chargement && !donnees} erreur={erreur} vide={visibles.length === 0}
          messageVide={commandes.length ? 'Aucune commande ne correspond.' : 'Aucune commande pour le moment.'}
          onReessayer={() => void recharger()} />
        {visibles.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Client</th>
                <th>Adresse</th>
                <th>Livraison</th>
                <th>Paiement</th>
                <th className="nombre">Montant</th>
                <th>Statut</th>
                <th>Créée le</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((l) => (
                <tr key={l.id} className="cliquable" onClick={() => setDetail(l)}>
                  <td className="mono">{l.codeSuivi}</td>
                  <td>{l.clientEmail}</td>
                  <td className="tronque" title={l.adresse}>{l.adresse}</td>
                  <td className="sans-retour">
                    {l.nomPartenaire ?? (l.typeLivraison === 'IMMEDIATE' ? 'Immédiate' : formatCreneau(l.creneauDebut, l.creneauFin))}
                  </td>
                  <td>{MODES_PAIEMENT[l.modePaiement]}</td>
                  <td className="nombre">{formatMontant(l.montantTotal)}</td>
                  <td><Badge texte={STATUTS[l.statut].libelle} {...STATUTS[l.statut]} /></td>
                  <td className="discret sans-retour">{formatDate(l.dateCreation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detail && <DetailCommande livraison={detail} onFermer={() => setDetail(null)} />}
    </>
  );
}

function DetailCommande({ livraison: l, onFermer }: { livraison: Livraison; onFermer: () => void }) {
  const carte = `https://www.openstreetmap.org/?mlat=${l.latitude}&mlon=${l.longitude}#map=16/${l.latitude}/${l.longitude}`;
  return (
    <Modale titre={`Commande ${l.codeSuivi}`} onFermer={onFermer}>
      <div className="detail-statut">
        <Badge texte={STATUTS[l.statut].libelle} {...STATUTS[l.statut]} />
        <span className="discret">Créée le {formatDate(l.dateCreation)}</span>
      </div>
      <dl className="details">
        {l.nomPartenaire && <><dt>Partenaire</dt><dd>{l.nomPartenaire}</dd><dt>Articles</dt><dd>{l.lignes.map(ligne => <div key={ligne.produitId}>{ligne.quantite} × {ligne.nomProduit} · {formatMontant(ligne.prixUnitaire)} = {formatMontant(ligne.sousTotal)}</div>)}</dd><dt>Notes</dt><dd>{l.notes || '—'}</dd></>}
        <dt>Client</dt><dd>{l.clientEmail}</dd>
        <dt>Adresse</dt>
        <dd>
          {l.adresse}<br />
          <a href={carte} target="_blank" rel="noreferrer">
            {l.latitude.toFixed(5)}, {l.longitude.toFixed(5)} — voir sur la carte
          </a>
        </dd>
        <dt>Type</dt><dd>{l.typeLivraison ? TYPES_LIVRAISON[l.typeLivraison] : '—'}</dd>
        <dt>Créneau</dt><dd>{formatCreneau(l.creneauDebut, l.creneauFin)}</dd>
        <dt>Distance</dt><dd>{formatDistance(l.distanceKm)}</dd>
        <dt>Paiement</dt>
        <dd>
          {MODES_PAIEMENT[l.modePaiement]}
          {l.statutPaiement && <span className="discret"> · {STATUTS_PAIEMENT[l.statutPaiement]}</span>}
        </dd>
        <dt>Frais de livraison</dt><dd>{formatMontant(l.fraisLivraison)}</dd>
        {l.supplementImmediat > 0 && <><dt>Supplément immédiat</dt><dd>{formatMontant(l.supplementImmediat)}</dd></>}
        <dt>Total</dt><dd><strong>{formatMontant(l.montantTotal)}</strong></dd>
        <dt>À collecter</dt><dd>{formatMontant(l.montantACollecter)}</dd>
      </dl>
    </Modale>
  );
}
