import { type FormEvent } from 'react';
import { StatCard } from './ui';
import { valeurBi } from '../../../mobile/packages/shared/src/bi';

export function FiltresBi({ debut, fin, onDebut, onFin, onValider, chargement, children }: {
  debut: string; fin: string; onDebut: (v: string) => void; onFin: (v: string) => void;
  onValider: () => void; chargement: boolean; children?: React.ReactNode;
}) {
  function soumettre(e: FormEvent) { e.preventDefault(); onValider(); }
  return <form className="filtres bi-filtres" onSubmit={soumettre}>
    <label className="champ">Du<input type="date" value={debut} max={fin} required onChange={e => onDebut(e.target.value)} /></label>
    <label className="champ">Au (inclus)<input type="date" value={fin} min={debut} required onChange={e => onFin(e.target.value)} /></label>
    {children}<button className="bouton" disabled={chargement}>{chargement ? 'Chargement…' : 'Appliquer / actualiser'}</button>
    <p className="bi-legende">Dates incluses, fuseau Africa/Tunis. Période de 366 jours maximum.</p>
  </form>;
}
export function Indicateur({ titre, valeur, unite = '', legende }: { titre: string; valeur: number | null; unite?: string; legende: string }) {
  return <StatCard titre={titre} valeur={valeurBi(valeur, unite)} note={legende} />;
}
