import { Children, cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, ChevronsUpDown, Inbox, LoaderCircle, Search, X } from 'lucide-react';

export type TonBadge = 'neutre' | 'succes' | 'danger' | 'attention' | 'accent';
/** Ignore les réponses anciennes, y compris après démontage et double montage StrictMode. */
export function useDonnees<T>(charger: () => Promise<T>) {
  const [donnees, setDonnees] = useState<T | null>(null), [erreur, setErreur] = useState<string | null>(null), [chargement, setChargement] = useState(true);
  const version = useRef(0);
  const recharger = useCallback(async () => {
    const courante = ++version.current; setChargement(true);
    try { const resultat = await charger(); if (courante === version.current) { setDonnees(resultat); setErreur(null); } }
    catch (e) { if (courante === version.current) setErreur(e instanceof Error ? e.message : 'Chargement impossible. Réessayez.'); }
    finally { if (courante === version.current) setChargement(false); }
  }, [charger]);
  useEffect(() => { void recharger(); return () => { version.current++; }; }, [recharger]);
  return { donnees, erreur, chargement, recharger };
}
export function EnTete({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children?: ReactNode }) {
  return <header className="en-tete"><div><h1>{titre}</h1>{sousTitre && <p>{sousTitre}</p>}</div>{children && <div className="actions">{children}</div>}</header>;
}
export function Button({ variante = 'primaire', taille = 'normale', chargement, children, className = '', disabled, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primaire' | 'secondaire' | 'fantome' | 'danger'; taille?: 'petite' | 'normale'; chargement?: boolean }) {
  return <button {...props} type={type} className={`bouton ${variante} taille-${taille} ${className}`} disabled={disabled || chargement} aria-busy={chargement || undefined}>{chargement && <LoaderCircle className="rotation" size={16} aria-hidden="true" />}{children}</button>;
}
type ControleChamp = { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean };
export function Champ({ libelle, aide, erreur, children }: { libelle: string; aide?: string; erreur?: string | null; children: ReactNode }) {
  const identifiant = useId();
  const enfant = Children.toArray(children).find(isValidElement) as ReactElement<ControleChamp> | undefined;
  const id = enfant?.props.id ?? identifiant;
  const description = [enfant?.props['aria-describedby'], aide && `${identifiant}-aide`, erreur && `${identifiant}-erreur`].filter(Boolean).join(' ') || undefined;
  return <div className="champ"><label htmlFor={id}>{libelle}</label>{enfant ? cloneElement(enfant, { id, 'aria-describedby': description, 'aria-invalid': !!erreur || undefined }) : children}{aide && <small id={`${identifiant}-aide`}>{aide}</small>}{erreur && <small className="erreur-champ" id={`${identifiant}-erreur`} role="alert">{erreur}</small>}</div>;
}
type InfosChamp = { libelle: string; aide?: string; erreur?: string | null };
export function Input({ libelle, aide, erreur, ...props }: InputHTMLAttributes<HTMLInputElement> & InfosChamp) { return <Champ libelle={libelle} aide={aide} erreur={erreur}><input {...props} /></Champ>; }
export function Select({ libelle, aide, erreur, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & InfosChamp) { return <Champ libelle={libelle} aide={aide} erreur={erreur}><select {...props}>{children}</select></Champ>; }
export function Textarea({ libelle, aide, erreur, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & InfosChamp) { return <Champ libelle={libelle} aide={aide} erreur={erreur}><textarea {...props} /></Champ>; }
/** couleur/fond : compatibilité des anciens écrans, jamais appliqués au DOM. */
export function Badge({ texte, ton, couleur }: { texte: string; ton?: TonBadge; couleur?: string; fond?: string }) {
  const c = couleur?.toLowerCase() ?? '';
  const semantique = c.includes('danger') || ['#b91c1c', '#dc2626'].includes(c) ? 'danger' : c.includes('succes') || ['#15803d', '#047857', '#16a34a'].includes(c) ? 'succes' : c.includes('attention') || c === '#b45309' ? 'attention' : 'neutre';
  return <span className={`badge ton-${ton ?? semantique}`}>{texte}</span>;
}
export function BadgeActif({ actif }: { actif: boolean }) { return <Badge texte={actif ? 'Actif' : 'Inactif'} ton={actif ? 'succes' : 'neutre'} />; }
export function Card({ titre, action, children, className = '' }: { titre?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`carte panneau ${className}`}>{(titre || action) && <div className="panneau-tete">{titre && <h2>{titre}</h2>}{action}</div>}{children}</section>;
}
export function Sparkline({ serie }: { serie: number[] }) {
  if (serie.length < 2) return null;
  const min = Math.min(...serie), amplitude = Math.max(...serie) - min || 1;
  const points = serie.map((v, i) => `${i / (serie.length - 1) * 100},${28 - (v - min) / amplitude * 24}`).join(' ');
  return <svg className="sparkline" viewBox="0 0 100 32" aria-hidden="true"><polyline points={points} /></svg>;
}
export function StatCard({ titre, valeur, note, variation, ton = 'neutre', serie, icone }: { titre: string; valeur: ReactNode; note?: ReactNode; variation?: string; ton?: TonBadge; serie?: number[]; icone?: ReactNode }) {
  return <article className="stat-card"><div className="stat-titre"><span>{titre}</span>{icone && <span aria-hidden="true">{icone}</span>}</div><strong className="stat-valeur">{valeur}</strong><div className="stat-pied">{variation && <Badge texte={variation} ton={ton} />}{note && <span className="stat-note">{note}</span>}{serie && <Sparkline serie={serie} />}</div></article>;
}
export function Skeleton({ lignes = 3 }: { lignes?: number }) { return <div role="status" aria-label="Chargement en cours" aria-busy="true" className="squelettes">{Array.from({ length: lignes }, (_, i) => <div key={i} className="squelette" />)}</div>; }
export function EmptyState({ titre = 'Aucun résultat', texte, action, icone }: { titre?: string; texte?: string; action?: ReactNode; icone?: ReactNode }) { return <div className="vide"><span className="vide-icone" aria-hidden="true">{icone ?? <Inbox size={24} />}</span><h3>{titre}</h3>{texte && <p>{texte}</p>}{action}</div>; }
export function ErrorState({ message, onReessayer }: { message: string; onReessayer: () => void }) { return <div className="etat etat-erreur" role="alert"><AlertCircle size={24} aria-hidden="true" /><h3>Chargement indisponible</h3><p>{message}</p><Button variante="secondaire" onClick={onReessayer}>Réessayer</Button></div>; }
export function Alerte({ message, onFermer }: { message: string; onFermer?: () => void }) { return <div className="alerte" role="alert"><AlertCircle size={18} aria-hidden="true" /><span>{message}</span>{onFermer && <button className="bouton-icone" aria-label="Fermer le message" onClick={onFermer}><X size={18} /></button>}</div>; }
export function EtatTableau({ chargement, erreur, vide, messageVide, onReessayer }: { chargement: boolean; erreur: string | null; vide: boolean; messageVide: string; onReessayer: () => void }) {
  if (erreur) return <ErrorState message={erreur} onReessayer={onReessayer} />;
  if (chargement) return <Skeleton />;
  if (vide) return <EmptyState texte={messageVide} />;
  return null;
}
function Fenetre({ titre, onFermer, children, laterale }: { titre: string; onFermer: () => void; children: ReactNode; laterale?: boolean }) {
  const boite = useRef<HTMLDivElement>(null), fermeture = useRef(onFermer); fermeture.current = onFermer;
  const titreId = useId();
  useEffect(() => {
    const precedent = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = boite.current, defilement = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const elements = () => Array.from(element?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') ?? []).filter(e => e.getClientRects().length > 0 && !e.closest('[inert]'));
    (elements()[0] ?? element)?.focus();
    const freres = [...document.body.children].filter(e => e !== element?.parentElement && e instanceof HTMLElement) as HTMLElement[];
    const etats = freres.map(e => e.inert); freres.forEach(e => { e.inert = true; });
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermeture.current(); }
      if (e.key === 'Tab') { const liste = elements(), premier = liste[0], dernier = liste[liste.length - 1]; if (!premier) { e.preventDefault(); element?.focus(); } else if (e.shiftKey && (document.activeElement === premier || document.activeElement === element)) { e.preventDefault(); dernier.focus(); } else if (!e.shiftKey && (document.activeElement === dernier || !element?.contains(document.activeElement))) { e.preventDefault(); premier.focus(); } }
    };
    const retenir = (e: FocusEvent) => { if (!element?.contains(e.target as Node)) (elements()[0] ?? element)?.focus(); };
    document.addEventListener('keydown', clavier); document.addEventListener('focusin', retenir);
    return () => { document.removeEventListener('keydown', clavier); document.removeEventListener('focusin', retenir); document.body.style.overflow = defilement; freres.forEach((e, i) => { e.inert = etats[i]; }); if (precedent?.isConnected) precedent.focus(); };
  }, []);
  return createPortal(<div className={`voile ${laterale ? 'voile-drawer' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) onFermer(); }}><div className={laterale ? 'drawer' : 'modale'} ref={boite} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titreId}><div className="modale-tete"><h2 id={titreId}>{titre}</h2><button type="button" className="bouton-icone" aria-label="Fermer" onClick={onFermer}><X size={20} /></button></div><div className="fenetre-contenu">{children}</div></div></div>, document.body);
}
export function Modale(props: { titre: string; onFermer: () => void; children: ReactNode }) { return <Fenetre {...props} />; }
export const Modal = Modale;
export function Drawer(props: { titre: string; onFermer: () => void; children: ReactNode }) { return <Fenetre {...props} laterale />; }
export function Tooltip({ texte, children }: { texte: string; children: ReactNode }) { const id = useId(); return <span className="infobulle" tabIndex={0} aria-describedby={id}>{children}<span role="tooltip" id={id}>{texte}</span></span>; }
export function Tabs<T extends string>({ onglets, valeur, onChange, label = 'Sections' }: { onglets: { valeur: T; libelle: string; contenu: ReactNode }[]; valeur: T; onChange: (v: T) => void; label?: string }) {
  const id = useId();
  return <><div role="tablist" aria-label={label} className="onglets">{onglets.map((o, i) => <button key={o.valeur} id={`${id}-${o.valeur}`} role="tab" aria-selected={valeur === o.valeur} aria-controls={`${id}-panneau-${o.valeur}`} tabIndex={valeur === o.valeur ? 0 : -1} onClick={() => onChange(o.valeur)} onKeyDown={e => { const index = e.key === 'ArrowRight' ? (i + 1) % onglets.length : e.key === 'ArrowLeft' ? (i - 1 + onglets.length) % onglets.length : e.key === 'Home' ? 0 : e.key === 'End' ? onglets.length - 1 : -1; if (index >= 0) { e.preventDefault(); onChange(onglets[index].valeur); document.getElementById(`${id}-${onglets[index].valeur}`)?.focus(); } }}>{o.libelle}</button>)}</div>{onglets.map(o => <div key={o.valeur} id={`${id}-panneau-${o.valeur}`} role="tabpanel" aria-labelledby={`${id}-${o.valeur}`} hidden={valeur !== o.valeur} tabIndex={0}>{o.contenu}</div>)}</>;
}
export function Breadcrumb({ elements }: { elements: { libelle: string; vers?: string }[] }) { return <nav aria-label="Fil d’Ariane" className="fil-ariane"><ol>{elements.map((e, i) => <li key={`${e.libelle}-${i}`}>{i > 0 && <ChevronRight size={13} aria-hidden="true" />}{e.vers ? <Link to={e.vers}>{e.libelle}</Link> : <span aria-current={i === elements.length - 1 ? 'page' : undefined}>{e.libelle}</span>}</li>)}</ol></nav>; }
export function Pagination({ page, total, taille, onChange, onTaille }: { page: number; total: number; taille: number; onChange: (page: number) => void; onTaille?: (taille: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / taille));
  return <nav className="pagination" aria-label="Pagination"><span>{total ? `${page * taille + 1}–${Math.min((page + 1) * taille, total)}` : '0'} sur {total} résultat{total > 1 ? 's' : ''}</span><div className="actions">{onTaille && <label className="taille-page">Lignes<select aria-label="Lignes par page" value={taille} onChange={e => onTaille(Number(e.target.value))}>{[10, 25, 50].map(n => <option key={n}>{n}</option>)}</select></label>}<Button variante="fantome" taille="petite" aria-label="Page précédente" disabled={page === 0} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /></Button><span>{page + 1} / {pages}</span><Button variante="fantome" taille="petite" aria-label="Page suivante" disabled={page + 1 >= pages} onClick={() => onChange(page + 1)}><ChevronRight size={16} /></Button></div></nav>;
}
type Notification = { id: number; message: string; ton: 'succes' | 'danger' };
const ContexteToast = createContext<(message: string, ton?: 'succes' | 'danger') => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Notification[]>([]), numero = useRef(0), minuteries = useRef<ReturnType<typeof setTimeout>[]>([]);
  const notifier = useCallback((message: string, ton: 'succes' | 'danger' = 'succes') => { const id = ++numero.current; setMessages(p => [...p.slice(-3), { id, message, ton }]); minuteries.current.push(setTimeout(() => setMessages(p => p.filter(m => m.id !== id)), 8000)); }, []);
  useEffect(() => () => minuteries.current.forEach(clearTimeout), []);
  return <ContexteToast.Provider value={notifier}>{children}<div className="toasts" aria-label="Notifications">{messages.map(m => <div key={m.id} className={`toast ton-${m.ton}`} role={m.ton === 'danger' ? 'alert' : 'status'}>{m.ton === 'succes' ? <CheckCircle2 size={18} aria-hidden="true" /> : <AlertCircle size={18} aria-hidden="true" />}<span>{m.message}</span><button className="bouton-icone" aria-label="Fermer la notification" onClick={() => setMessages(p => p.filter(n => n.id !== m.id))}><X size={16} /></button></div>)}</div></ContexteToast.Provider>;
}
export const useToast = () => useContext(ContexteToast);
export type Colonne<T> = { cle: string; titre: string; rendu: (ligne: T) => ReactNode; valeur?: (ligne: T) => string | number | null | undefined; nombre?: boolean };
export type FiltrePuce = { cle: string; libelle: string; actif: boolean; onClick: () => void };
export function DataTable<T>({ titre, lignes, colonnes, cleLigne, rechercher, rechercheInitiale = '', filtres, controles, chargement = false, erreur = null, onReessayer = () => {}, onLigne, messageVide = 'Aucune donnée ne correspond aux filtres.', actionVide }: {
  titre: string; lignes: T[]; colonnes: Colonne<T>[]; cleLigne: (ligne: T) => string | number; rechercher?: (ligne: T, recherche: string) => boolean; rechercheInitiale?: string; filtres?: FiltrePuce[]; controles?: ReactNode; chargement?: boolean; erreur?: string | null; onReessayer?: () => void; onLigne?: (ligne: T) => void; messageVide?: string; actionVide?: ReactNode;
}) {
  const [recherche, setRecherche] = useState(rechercheInitiale), [tri, setTri] = useState<{ cle: string; sens: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0), [taille, setTaille] = useState(10), [dense, setDense] = useState(false);
  const filtre = useMemo(() => {
    const q = recherche.trim().toLocaleLowerCase('fr'); const resultat = rechercher && q ? lignes.filter(l => rechercher(l, q)) : [...lignes];
    const colonne = colonnes.find(c => c.cle === tri?.cle);
    if (colonne?.valeur && tri) { const valeur = colonne.valeur; resultat.sort((a, b) => { const x = valeur(a) ?? '', y = valeur(b) ?? ''; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fr', { numeric: true })) * tri.sens; }); }
    return resultat;
  }, [lignes, recherche, rechercher, tri, colonnes]);
  useEffect(() => { setPage(0); }, [recherche, taille, lignes]);
  const courante = Math.min(page, Math.max(0, Math.ceil(filtre.length / taille) - 1));
  return <section className={`data-table carte ${dense ? 'dense' : ''}`} aria-label={titre}><div className="table-outils">{rechercher && <label className="table-recherche"><Search size={17} aria-hidden="true" /><span className="sr-only">Rechercher dans {titre}</span><input type="search" placeholder="Rechercher…" value={recherche} onChange={e => setRecherche(e.target.value)} /></label>}<div className="actions">{controles}<label className="table-densite"><span>Densité</span><select value={dense ? 'compacte' : 'confort'} onChange={e => setDense(e.target.value === 'compacte')}><option value="confort">Confort</option><option value="compacte">Compacte</option></select></label></div></div>{!!filtres?.length && <div className="table-puces" aria-label="Filtres rapides">{filtres.map(f => <button type="button" key={f.cle} className={`puce ${f.actif ? 'active' : ''}`} aria-pressed={f.actif} onClick={f.onClick}>{f.libelle}</button>)}</div>}{erreur ? <ErrorState message={erreur} onReessayer={onReessayer} /> : chargement ? <Skeleton lignes={5} /> : !filtre.length ? <EmptyState texte={messageVide} action={actionVide} /> : <div className="table-defile" tabIndex={0} role="region" aria-label={`Tableau ${titre}, défilement horizontal disponible`}><table><caption className="sr-only">{titre}</caption><thead><tr>{colonnes.map(c => <th scope="col" key={c.cle} className={c.nombre ? 'nombre' : ''} aria-sort={tri?.cle === c.cle ? tri.sens === 1 ? 'ascending' : 'descending' : c.valeur ? 'none' : undefined}>{c.valeur ? <button type="button" onClick={() => setTri(p => ({ cle: c.cle, sens: p?.cle === c.cle && p.sens === 1 ? -1 : 1 }))}>{c.titre}{tri?.cle === c.cle ? tri.sens === 1 ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" /> : <ChevronsUpDown size={13} aria-hidden="true" />}</button> : c.titre}</th>)}</tr></thead><tbody>{filtre.slice(courante * taille, (courante + 1) * taille).map(l => <tr key={cleLigne(l)} className={onLigne ? 'ligne-cliquable' : undefined} onClick={e => { if (onLigne && !(e.target as HTMLElement).closest('button,a,input,select,textarea')) onLigne(l); }}>{colonnes.map((c, i) => <td key={c.cle} className={c.nombre ? 'nombre' : ''}>{onLigne && i === 0 ? <button className="lien-detail" onClick={() => onLigne(l)}>{c.rendu(l)}<span className="sr-only"> — ouvrir le détail</span></button> : c.rendu(l)}</td>)}</tr>)}</tbody></table></div>}{!erreur && !chargement && <Pagination page={courante} total={filtre.length} taille={taille} onChange={setPage} onTaille={setTaille} />}</section>;
}
/** CSV UTF-8 pour tableur ; neutralise les formules venant des données utilisateur. */
export function exporterCsv(nom: string, entetes: string[], lignes: (string | number | null | undefined)[][]) {
  const cellule = (v: string | number | null | undefined) => { const texte = String(v ?? ''); return `"${(typeof v === 'string' && /^[=+\-@\t\r]/.test(texte) ? `'${texte}` : texte).replaceAll('"', '""')}"`; };
  const contenu = '\uFEFF' + [entetes, ...lignes].map(l => l.map(cellule).join(';')).join('\r\n'); const url = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }));
  const lien = document.createElement('a'); lien.href = url; lien.download = `${nom}.csv`; lien.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
