import { useCallback, useEffect, useState, type ReactNode } from 'react';

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

export function Badge({ texte, couleur, fond }: { texte: string; couleur: string; fond: string }) {
  return <span className="badge" style={{ color: couleur, background: fond }}>{texte}</span>;
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
  if (chargement) return <div className="etat"><span className="spinner" /></div>;
  if (vide) return <div className="etat"><p>{messageVide}</p></div>;
  return null;
}

export function Modale({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: ReactNode }) {
  useEffect(() => {
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer(); };
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [onFermer]);

  return (
    <div className="voile" onMouseDown={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <div className="modale" role="dialog" aria-modal="true" aria-label={titre}>
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
