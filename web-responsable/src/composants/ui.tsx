import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/** Charge une ressource API ; recharger() relance l'appel apres une modification. */
export function useDonnees<T>(charger: () => Promise<T>) {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  const recharger = useCallback(async () => {
    setChargement(true);
    try {
      setDonnees(await charger());
      setErreur(null);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setChargement(false);
    }
  }, [charger]);

  useEffect(() => { void recharger(); }, [recharger]);

  return { donnees, erreur, chargement, recharger };
}

export function EnTete({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children?: ReactNode }) {
  return (
    <header className="en-tete">
      <div>
        <h1>{titre}</h1>
        {sousTitre && <p>{sousTitre}</p>}
      </div>
      <div className="actions">{children}</div>
    </header>
  );
}

/** Pastille d'etat : la couleur d'origine est ramenee a l'un des tons du systeme (succes, danger, neutre, ambre). */
export function Badge({ texte, couleur }: { texte: string; couleur: string; fond?: string }) {
  return <span className={`badge ton-${tonDepuisCouleur(couleur)}`}>{texte}</span>;
}

function tonDepuisCouleur(couleur: string): 'succes' | 'danger' | 'neutre' | 'accent' {
  const hex = couleur.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  if ([r, g, b].some(Number.isNaN)) return 'accent';
  if (Math.max(r, g, b) - Math.min(r, g, b) < 30) return 'neutre';
  if (r > g + 40 && r > b + 40 && g < 80) return 'danger';
  if (g > r && g >= b) return 'succes';
  return 'accent';
}

export function BadgeActif({ actif }: { actif: boolean }) {
  return actif
    ? <Badge texte="Actif" couleur="#15803D" fond="#DCFCE7" />
    : <Badge texte="Inactif" couleur="#4B5563" fond="#F3F4F6" />;
}

export function Alerte({ message, onFermer }: { message: string; onFermer?: () => void }) {
  return (
    <div className="alerte" role="alert">
      <span>{message}</span>
      {onFermer && <button className="bouton-lien" onClick={onFermer}>Fermer</button>}
    </div>
  );
}

export function EtatTableau({ chargement, erreur, vide, messageVide, onReessayer }: {
  chargement: boolean;
  erreur: string | null;
  vide: boolean;
  messageVide: string;
  onReessayer: () => void;
}) {
  if (erreur) {
    return (
      <div className="etat">
        <p>{erreur}</p>
        <button className="bouton secondaire" onClick={onReessayer}>Réessayer</button>
      </div>
    );
  }
  if (chargement) return <div aria-busy="true" aria-label="Chargement">{[0, 1, 2].map(i => <div key={i} className="squelette" style={{ opacity: 1 - i * 0.25 }} />)}</div>;
  if (vide) return <div className="vide"><span className="vide-icone" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="4" y="5" width="16" height="14" rx="3" /><path d="M8 10h8M8 14h5" /></svg></span><p>{messageVide}</p></div>;
  return null;
}

export function Modale({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: ReactNode }) {
  const boite = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = boite.current;
    if (element && !element.contains(document.activeElement)) {
      (element.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)') ?? element).focus();
    }
  });
  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    const element = boite.current;
    const focusables = () => Array.from(element?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? []);
    (focusables()[0] ?? element)?.focus();
    const retenirFocus = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const elements = focusables();
      const premier = elements[0]; const dernier = elements[elements.length - 1];
      if (!premier) { e.preventDefault(); element?.focus(); }
      else if (e.shiftKey && (document.activeElement === premier || document.activeElement === element)) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    };
    document.addEventListener('keydown', retenirFocus);
    return () => { document.removeEventListener('keydown', retenirFocus); precedent?.focus(); };
  }, []);
  useEffect(() => {
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer(); };
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [onFermer]);

  return (
    <div className="voile" onMouseDown={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <div ref={boite} tabIndex={-1} className="modale" role="dialog" aria-modal="true" aria-label={titre}>
        <div className="modale-tete">
          <h2>{titre}</h2>
          <button className="bouton-icone" onClick={onFermer} aria-label="Fermer">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Champ({ libelle, aide, children }: { libelle: string; aide?: string; children: ReactNode }) {
  return (
    <label className="champ">
      <span>{libelle}</span>
      {children}
      {aide && <small>{aide}</small>}
    </label>
  );
}
