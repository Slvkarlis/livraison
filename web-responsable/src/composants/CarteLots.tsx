import { useMemo, useState } from 'react';
import { api } from '../api';
import type { LotSupervision } from '../types';
import { arcEntre, CENTRE_TUNIS, pointValide, type ArcCarte } from '../suivi';
import CarteMission from './CarteMission';
import { EtatTableau, useDonnees } from './ui';

export default function CarteLots({ lots, erreur, chargement }: { lots: LotSupervision[]; erreur: string | null; chargement: boolean }) {
  const commandes = useDonnees(api.livraisons);
  const [latitude, setLatitude] = useState(String(CENTRE_TUNIS[1])), [longitude, setLongitude] = useState(String(CENTRE_TUNIS[0]));
  const valide = latitude.trim() !== '' && longitude.trim() !== '' && pointValide(Number(longitude), Number(latitude));
  const arcs = useMemo<ArcCarte[]>(() => valide ? lots.flatMap((lot, couleur) => lot.commandes.flatMap(c => {
    const commande = commandes.donnees?.find(l => l.id === c.id);
    return commande && pointValide(commande.longitude, commande.latitude) ? [{ id: lot.id, couleur, points: arcEntre([Number(longitude), Number(latitude)], [commande.longitude, commande.latitude]) }] : [];
  })) : [], [lots, commandes.donnees, latitude, longitude, valide]);
  const sansPosition = lots.reduce((s, l) => s + l.commandes.length, 0) - arcs.length;
  return <section className="carte-lots" aria-label="Carte des lots de dispatch">
    <div className="carte"><h2>Du dépôt aux destinations</h2><p className="discret">Renseignez le point de départ du dépôt. Par défaut : centre de Tunis, à titre indicatif. Les arcs représentent les affectations, sans guidage routier.</p>
      <div className="grille-2">
        <label className="champ">Latitude du dépôt<input type="number" step="any" min="-90" max="90" value={latitude} onChange={e => setLatitude(e.target.value)} aria-invalid={!valide} /></label>
        <label className="champ">Longitude du dépôt<input type="number" step="any" min="-180" max="180" value={longitude} onChange={e => setLongitude(e.target.value)} aria-invalid={!valide} /></label>
      </div>
      {!valide && <p role="alert">Indiquez des coordonnées valides pour afficher les arcs.</p>}
      <EtatTableau chargement={chargement || commandes.chargement} erreur={erreur ?? commandes.erreur} vide={!arcs.length} messageVide="Aucun lot géolocalisé. Les lots apparaîtront dès leur formation et la disponibilité des destinations." onReessayer={() => void commandes.recharger()} />
      {sansPosition > 0 && <p className="discret">{sansPosition} destination(s) sans coordonnées affichables.</p>}
      <ul className="lots-legende">{lots.map((lot, i) => <li key={lot.id}><span style={{ background: `var(--lot-${i % 5})` }} aria-hidden="true" />Lot n° {lot.id} · {lot.commandes.map(c => c.codeSuivi).join(', ')}</li>)}</ul>
    </div>
    <div className="mission mission-lots"><CarteMission arcs={arcs} /></div>
  </section>;
}
