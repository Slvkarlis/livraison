import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CarteVille3D } from './CarteVille3D';

/* Composants de la refonte (systeme Doop : StatHero, StatTile, RouteTimeline, Pill, OrderRow,
   CounterTile, FilterChip, StepTimeline). Les styles sont dans refonte.css. */

const reduit = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Compte de 0 jusqu'a la valeur (ease-out), une fois a l'apparition. */
export function useCompteur(cible: number, duree = 1100) {
  const [valeur, setValeur] = useState(reduit() ? cible : 0);
  const depart = useRef(0);
  useEffect(() => {
    if (reduit()) { setValeur(cible); return; }
    const de = depart.current;
    let image = 0;
    const t0 = performance.now();
    const pas = (t: number) => {
      const p = Math.min(1, (t - t0) / duree);
      const v = de + (cible - de) * (1 - Math.pow(1 - p, 3));
      setValeur(v);
      if (p < 1) image = requestAnimationFrame(pas); else depart.current = cible;
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [cible, duree]);
  return valeur;
}

/** Nombre anime ; format recoit la valeur courante. */
export function Chiffre({ valeur, format = (v) => Math.round(v).toLocaleString('fr-FR') }: { valeur: number; format?: (v: number) => string }) {
  return <>{format(useCompteur(valeur))}</>;
}

export type Ton = 'accent' | 'succes' | 'danger' | 'neutre' | 'nuit' | 'verre';

export function Pastille({ ton = 'accent', children, pulse = false }: { ton?: Ton; children: ReactNode; pulse?: boolean }) {
  return <span className="pl" data-ton={ton} data-pulse={pulse || undefined}><i />{children}</span>;
}

export function StatHero({ legende, valeur, note, pastille = 'En direct' }: { legende: string; valeur: ReactNode; note?: ReactNode; pastille?: string }) {
  return (
    <article className="sh inclinable">
      <div className="sh-carte"><CarteVille3D ton="nuit" /></div>
      <div className="sh-in">
        <div className="sh-haut"><span className="sh-leg">{legende}</span><Pastille ton="verre" pulse>{pastille}</Pastille></div>
        <strong className="sh-v">{valeur}</strong>
        {note && <p className="sh-n">{note}</p>}
      </div>
    </article>
  );
}

/** Courbe miniature tracee a l'apparition. Sans serie, une tendance montante neutre. */
function Etincelle({ serie }: { serie?: number[] }) {
  const pts = serie && serie.length > 1 ? serie : [3, 4, 3.6, 5, 4.8, 6, 6.6];
  const min = Math.min(...pts); const max = Math.max(...pts); const amp = max - min || 1;
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * 100} ${26 - ((v - min) / amp) * 22}`).join(' ');
  return <svg className="st-et" viewBox="0 0 100 30" width="110" height="34" aria-hidden="true"><path d={d} /></svg>;
}

export function StatTuile({ legende, valeur, unite, delta, ton = 'succes', note, serie }: {
  legende: string; valeur: ReactNode; unite?: string; delta?: string; ton?: Ton; note?: string; serie?: number[];
}) {
  return (
    <article className="st inclinable">
      <span className="st-leg">{legende}</span>
      <strong className="st-v">{valeur}{unite && <small> {unite}</small>}</strong>
      {note && <p className="st-note">{note}</p>}
      <div className="st-b">{delta ? <Pastille ton={ton}>{delta}</Pastille> : <span />}<Etincelle serie={serie} /></div>
    </article>
  );
}

/** Frise de trajet (reference « Ride complete ») : heures, duree, piste avec disque ambre en mouvement. */
export function FriseTrajet({ depart, arrivee, duree, de, vers, distance, progression = 0.5 }: {
  depart: string; arrivee: string; duree: string; de: string; vers: string; distance: string; progression?: number;
}) {
  const p = Math.max(0, Math.min(1, progression));
  return (
    <div className="rt" style={{ ['--p' as string]: p }}>
      <div className="rt-h"><span>{depart}</span><strong>{duree}</strong><span>{arrivee}</span></div>
      <div className="rt-piste">
        <i className="a" /><span className="rt-rempli" />
        <span className="rt-disque"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7" /><circle cx="7" cy="17" r="1.6" /><circle cx="17" cy="17" r="1.6" /></svg></span>
        <i className="b" />
      </div>
      <div className="rt-f"><span>{de}</span><em>{distance}</em><span>{vers}</span></div>
    </div>
  );
}

export function LigneCommande({ initiale, titre, code, zone, heure, etat, ton, montant, choisie, onClick, rang = 0 }: {
  initiale: string; titre: string; code: string; zone: string; heure: string; etat: string; ton: Ton; montant: string;
  choisie?: boolean; onClick?: () => void; rang?: number;
}) {
  return (
    <button type="button" className={`or ${choisie ? 'choisie' : ''}`} onClick={onClick} style={{ animationDelay: `${Math.min(rang, 12) * 45}ms` }}>
      <span className="or-av">{initiale}</span>
      <span className="or-t"><strong>{titre}</strong><small>{[code, zone, heure].filter(Boolean).join(' · ')}</small></span>
      <Pastille ton={ton} pulse={ton === 'accent'}>{etat}</Pastille>
      <b className="or-m">{montant}</b>
    </button>
  );
}

export function CompteurTuile({ libelle, valeur, actif, onClick }: { libelle: string; valeur: number; actif?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className="ct" data-actif={actif || undefined} onClick={onClick}>
      <small>{libelle}</small><strong><Chiffre valeur={valeur} /></strong>
    </button>
  );
}

export function Puce({ libelle, active, onClick, compte }: { libelle: string; active?: boolean; onClick?: () => void; compte?: number }) {
  return <button type="button" className="fc" data-actif={active || undefined} onClick={onClick}>{libelle}{compte !== undefined && <span>{compte}</span>}</button>;
}

export type Etape = { titre: string; detail?: string; etat: 'fait' | 'encours' | 'avenir' | 'echec' };
export function FriseEtapes({ etapes }: { etapes: Etape[] }) {
  return (
    <ol className="stl">
      {etapes.map((e, i) => (
        <li key={i} data-etat={e.etat} style={{ animationDelay: `${i * 80}ms` }}><i /><div><strong>{e.titre}</strong>{e.detail && <small>{e.detail}</small>}</div></li>
      ))}
    </ol>
  );
}

/** Panneau blanc a coins profonds : titre, action et contenu. */
export function Panneau({ titre, action, children, className = '' }: { titre?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`pn ${className}`}>
      {(titre || action) && <div className="pn-h">{titre && <h2>{titre}</h2>}{action}</div>}
      {children}
    </section>
  );
}
