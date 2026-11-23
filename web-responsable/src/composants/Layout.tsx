import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, BarChart3, Bike, Building2, CarFront, ChartNoAxesCombined, ChevronDown, CircleHelp, ClipboardList, FileCheck2, FileClock, FolderOpen, LayoutDashboard, LogOut, Map, MapPin, Package, PanelLeftClose, PanelLeftOpen, Radio, Route, Search, Settings2, ShieldCheck, SlidersHorizontal, TriangleAlert, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import { useSession } from '../session';
import { peutAudit, peutFinance, peutOperations } from '../sprint1';
import { api } from '../api';
import FrontierePage from './FrontierePage';
import { BasculeTheme } from './Theme';
import { Breadcrumb, EmptyState, ErrorState, Modale, Skeleton, useDonnees } from './ui';

type Lien = { vers: string; libelle: string; icone: LucideIcon };
const LIENS: Lien[] = [
  { vers: '/accueil', libelle: 'Tableau de bord', icone: LayoutDashboard },
  { vers: '/suivi-live', libelle: 'Suivi en direct', icone: Radio },
  { vers: '/commandes', libelle: 'Commandes', icone: Package },
  { vers: '/dispatch', libelle: 'Dispatch', icone: Route },
  { vers: '/livreurs', libelle: 'Livreurs', icone: Bike },
  { vers: '/vehicules', libelle: 'Véhicules', icone: CarFront },
  { vers: '/zones', libelle: 'Zones et frais', icone: Map },
  { vers: '/echecs', libelle: 'Échecs de livraison', icone: TriangleAlert },
  { vers: '/finance', libelle: 'Finance', icone: Wallet },
  { vers: '/reclamations', libelle: 'Réclamations', icone: CircleHelp },
  { vers: '/bi-finance', libelle: 'BI Finance', icone: BarChart3 },
  { vers: '/bi-operations', libelle: 'BI Opérations', icone: Activity },
  { vers: '/bi-partenaires', libelle: 'BI Partenaires', icone: Building2 },
  { vers: '/bi-coursiers', libelle: 'BI Coursiers', icone: ChartNoAxesCombined },
  { vers: '/pilote', libelle: 'Pilote', icone: TrendingUp },
  { vers: '/previsions', libelle: 'Prévisions', icone: FileClock },
  { vers: '/prospection', libelle: 'Prospection', icone: MapPin },
  { vers: '/simulateur', libelle: 'Simulateur de lots', icone: SlidersHorizontal },
  { vers: '/dossiers', libelle: 'Dossiers', icone: FolderOpen },
  { vers: '/comptes', libelle: 'Comptes', icone: ShieldCheck },
  { vers: '/audit', libelle: 'Journal d’audit', icone: ClipboardList },
];
const GROUPES = [
  { titre: 'Espace de travail', vers: ['/accueil', '/suivi-live', '/commandes', '/dispatch'] },
  { titre: 'Gestion', vers: ['/livreurs', '/vehicules', '/zones', '/echecs', '/finance', '/reclamations'] },
  { titre: 'Analyse et croissance', vers: ['/bi-finance', '/bi-operations', '/bi-partenaires', '/bi-coursiers', '/pilote', '/previsions', '/prospection', '/simulateur'] },
  { titre: 'Administration', vers: ['/dossiers', '/comptes', '/audit'] },
];
function preferenceRail() { try { return localStorage.getItem('fleetpulse.rail') === 'replie'; } catch { return false; } }

export default function Layout() {
  const { profil, deconnexion } = useSession();
  const { pathname } = useLocation();
  const [repliee, setRepliee] = useState(preferenceRail), [palette, setPalette] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const operations = peutOperations(profil);
  const chargerCompteur = useCallback(() => operations ? api.livraisons() : Promise.resolve([]), [operations]);
  const commandes = useDonnees(chargerCompteur);
  const attente = commandes.donnees?.filter(c => c.statut === 'PENDING_PARTNER' || c.statut === 'PRETE').length;
  const visibles = LIENS.filter(l => l.vers === '/audit' ? peutAudit(profil) : ['/finance', '/bi-finance', '/reclamations'].includes(l.vers) ? peutFinance(profil) : operations);
  const page = LIENS.find(l => pathname.startsWith(l.vers))?.libelle ?? 'Espace responsable';
  const groupe = GROUPES.find(g => g.vers.includes(pathname))?.titre ?? 'FleetPulse';
  useEffect(() => { document.title = `${page} · FleetPulse`; menu.current?.removeAttribute('open'); }, [page]);
  useEffect(() => {
    const clavier = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p); } if (e.key === 'Escape') menu.current?.removeAttribute('open'); };
    const fermerMenu = (e: PointerEvent) => { if (!menu.current?.contains(e.target as Node)) menu.current?.removeAttribute('open'); };
    window.addEventListener('keydown', clavier); document.addEventListener('pointerdown', fermerMenu);
    return () => { window.removeEventListener('keydown', clavier); document.removeEventListener('pointerdown', fermerMenu); };
  }, []);
  useEffect(() => {
    const actif = document.querySelector<HTMLElement>('.sidebar nav a.actif'), nav = actif?.closest('nav');
    if (!actif || !nav) return;
    const afficher = () => { if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: actif.offsetLeft - 16, behavior: 'instant' }); };
    afficher(); const taille = new ResizeObserver(afficher); taille.observe(nav); return () => taille.disconnect();
  }, [pathname, repliee]);
  return <div className={`app ${repliee ? 'repliee' : ''}`}>
    <a className="evitement" href="#contenu-principal">Aller au contenu</a>
    <aside className="sidebar"><Link to={visibles[0]?.vers ?? '/audit'} className="marque" aria-label="FleetPulse, mon espace" style={{ textDecoration: 'none' }}><span className="logo"><Activity size={19} aria-hidden="true" /></span><span className="marque-texte"><strong>FleetPulse</strong><small>Espace responsable</small></span></Link>
      <nav aria-label="Navigation principale">{GROUPES.map(g => { const liens = g.vers.flatMap(v => visibles.filter(l => l.vers === v)); return liens.length ? <div className="groupe-nav" key={g.titre}><span className="groupe-titre">{g.titre}</span>{liens.map(({ vers, libelle, icone: Icone }) => <NavLink key={vers} to={vers} className={({ isActive }) => isActive ? 'actif' : ''} title={repliee ? libelle : undefined} aria-label={libelle}><Icone aria-hidden="true" /><span className="nav-libelle">{libelle}</span>{vers === '/commandes' && !!attente && <span className="nav-compteur" aria-label={`${attente} commandes en attente`}>{attente}</span>}</NavLink>)}</div> : null; })}</nav>
      <div className="sidebar-pied"><span><Settings2 size={13} aria-hidden="true" /> Tunis · Tunisie</span><button className="bouton-icone" aria-label={repliee ? 'Déplier la navigation' : 'Replier la navigation'} aria-expanded={!repliee} onClick={() => setRepliee(p => { try { localStorage.setItem('fleetpulse.rail', p ? 'deplie' : 'replie'); } catch { /* Préférence locale facultative. */ } return !p; })}>{repliee ? <PanelLeftOpen /> : <PanelLeftClose />}</button></div>
    </aside>
    <div className="zone-principale"><header className="barre"><Breadcrumb elements={[{ libelle: 'FleetPulse' }, { libelle: groupe }, { libelle: page }]} /><div className="barre-droite"><button className="recherche-globale" onClick={() => setPalette(true)} aria-label="Ouvrir la recherche globale"><Search size={16} aria-hidden="true" /><span>Rechercher…</span><kbd>Ctrl K</kbd></button><BasculeTheme /><details ref={menu} className="menu-utilisateur"><summary aria-label="Menu utilisateur"><span className="avatar">{profil?.prenom?.[0]}{profil?.nom?.[0]}</span><ChevronDown size={13} aria-hidden="true" /></summary><div className="menu-contenu"><strong>{profil?.prenom} {profil?.nom}</strong><p>{profil?.email}</p><p>{profil?.sousRole === 'FINANCE' ? 'Responsable finance' : profil?.sousRole === 'OPERATIONS' ? 'Responsable opérations' : 'Administrateur principal'}</p><button className="bouton secondaire" onClick={deconnexion}><LogOut size={16} aria-hidden="true" />Se déconnecter</button></div></details></div></header>
      <main className="contenu" id="contenu-principal" tabIndex={-1}><div className="page-entree"><FrontierePage key={pathname}><Outlet /></FrontierePage></div></main>
    </div>
    {palette && <Palette liens={visibles} operations={operations} onFermer={() => setPalette(false)} />}
  </div>;
}

function Palette({ liens, operations, onFermer }: { liens: Lien[]; operations: boolean; onFermer: () => void }) {
  const [recherche, setRecherche] = useState(''), navigate = useNavigate(), champ = useRef<HTMLInputElement>(null);
  const charger = useCallback(() => operations ? api.livraisons() : Promise.resolve([]), [operations]);
  const commandes = useDonnees(charger);
  useEffect(() => { champ.current?.focus(); }, []);
  const q = recherche.trim().toLocaleLowerCase('fr');
  const pages = liens.filter(l => l.libelle.toLocaleLowerCase('fr').includes(q));
  const resultats = q ? (commandes.donnees ?? []).filter(c => [c.codeSuivi, c.nomPartenaire, c.clientEmail, c.adresse].some(v => v?.toLocaleLowerCase('fr').includes(q))).slice(0, 8) : [];
  const choisir = (vers: string) => { onFermer(); navigate(vers); };
  return <Modale titre="Rechercher dans FleetPulse" onFermer={onFermer}><label className="champ palette-recherche"><span className="sr-only">Page, code de commande ou client</span><input ref={champ} type="search" placeholder="Une page, une commande, un client…" value={recherche} onChange={e => setRecherche(e.target.value)} onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); document.querySelector<HTMLElement>('.palette-liste a')?.focus(); } }} /></label><div className="palette-liste" onKeyDown={e => { if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return; const liste = [...e.currentTarget.querySelectorAll<HTMLAnchorElement>('a')], i = liste.indexOf(document.activeElement as HTMLAnchorElement); e.preventDefault(); liste[(i + (e.key === 'ArrowDown' ? 1 : -1) + liste.length) % liste.length]?.focus(); }}>
    {!!pages.length && <h3>Pages</h3>}{pages.map(({ vers, libelle, icone: Icone }) => <Link key={vers} to={vers} onClick={e => { e.preventDefault(); choisir(vers); }}><Icone size={17} aria-hidden="true" />{libelle}</Link>)}
    {operations && q && <><h3>Commandes</h3>{commandes.chargement ? <Skeleton lignes={2} /> : commandes.erreur ? <ErrorState message={commandes.erreur} onReessayer={() => void commandes.recharger()} /> : resultats.map(c => <Link key={c.id} to={`/commandes?id=${c.id}`} onClick={e => { e.preventDefault(); choisir(`/commandes?id=${c.id}`); }}><FileCheck2 size={17} aria-hidden="true" /><span className="mono">{c.codeSuivi}</span><small>{c.nomPartenaire ?? c.clientEmail}</small></Link>)}</>}
    {!pages.length && !resultats.length && !commandes.chargement && <EmptyState texte="Aucune page ou commande trouvée. Essayez un autre terme." />}
  </div></Modale>;
}
