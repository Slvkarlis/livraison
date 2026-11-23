import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useSession } from '../session';
import { peutAudit, peutFinance, peutOperations } from '../sprint1';

const LIENS = [
  { vers: '/suivi-live', libelle: 'Suivi en direct', icone: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M8 12h8M12 8v8' },
  { vers: '/bi-finance', libelle: 'BI Finance', icone: 'M4 20V10M10 20V4M16 20v-8M22 20H2' },
  { vers: '/bi-operations', libelle: 'BI Opérations', icone: 'M3 12h4l3-7 4 14 3-7h4' },
  { vers: '/bi-partenaires', libelle: 'BI Partenaires', icone: 'M3 10l2-6h14l2 6M4 10v10h16V10M8 20v-6h5v6M3 10h18' },
  { vers: '/bi-coursiers', libelle: 'BI Coursiers', icone: 'M12 3a9 9 0 1 0 9 9M12 3v9h9M6 17l3-3' },
  { vers: '/zones', libelle: 'Zones et frais', icone: 'M3 3l6 3 6-3 6 3v15l-6-3-6 3-6-3zM9 6v15M15 3v15' },
  { vers: '/dossiers', libelle: 'Dossiers', icone: 'M4 4h16v16H4zM8 8h8M8 12h8' },
  { vers: '/comptes', libelle: 'Comptes', icone: 'M3 5h18v14H3zM7 15v-1a3 3 0 0 1 6 0v1M10 8h.01M16 9h2M16 13h2' },
  { vers: '/audit', libelle: 'Journal d’audit', icone: 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h4' },
  { vers: '/commandes', libelle: 'Commandes', icone: 'M4 6h16M4 12h16M4 18h10' },
  { vers: '/finance', libelle: 'Finance', icone: 'M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6' },
  { vers: '/dispatch', libelle: 'Dispatch', icone: 'M5 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm14-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 15l10-8M5 13V5h6' },
  { vers: '/livreurs', libelle: 'Livreurs', icone: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0' },
  { vers: '/accueil', libelle: 'Tableau de bord', icone: 'M4 13h6V4H4zm0 7h6v-5H4zm10 0h6V11h-6zm0-16v5h6V4z' },
  { vers: '/echecs', libelle: 'Échecs de livraison', icone: 'M12 9v4m0 4h.01M4.9 19h14.2L12 5 4.9 19z' },
  { vers: '/reclamations', libelle: 'Réclamations', icone: 'M4 4h16v12H8l-4 4z' },
  { vers: '/pilote', libelle: 'Pilote', icone: 'M3 17l6-6 4 4 8-8M14 7h7v7' },
  { vers: '/previsions', libelle: 'Prévisions', icone: 'M4 19V5m0 14h16M8 15l3-4 3 2 5-6' },
  { vers: '/prospection', libelle: 'Prospection', icone: 'M16 16l5 5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M7 10h6M10 7v6' },
  { vers: '/simulateur', libelle: 'Simulateur de lots', icone: 'M4 6h6v6H4zM14 12h6v6h-6zM10 9h4M12 9v6' },
  { vers: '/vehicules', libelle: 'Véhicules', icone: 'M3 13l2-6h11l3 6v4h-2M3 13v4h2m0 0a2 2 0 1 0 4 0m-4 0a2 2 0 1 1 4 0m0 0h6m0 0a2 2 0 1 0 4 0m-4 0a2 2 0 1 1 4 0M3 13h16' },
];

const GROUPES: { titre: string; vers: string[] }[] = [
  { titre: 'Pilotage', vers: ['/accueil', '/bi-finance', '/bi-operations', '/bi-partenaires', '/bi-coursiers'] },
  { titre: 'Opérations', vers: ['/suivi-live', '/commandes', '/dispatch', '/echecs', '/zones', '/livreurs', '/vehicules'] },
  { titre: 'Croissance et analyse', vers: ['/pilote', '/previsions', '/prospection', '/simulateur'] },
  { titre: 'Finance', vers: ['/finance', '/reclamations'] },
  { titre: 'Administration', vers: ['/dossiers', '/comptes', '/audit'] },
];

const SELECTEUR_INCLINABLE = '.tdb-heros .inclinable';

export default function Layout() {
  const { profil, deconnexion } = useSession();
  const { pathname } = useLocation();

  // Barre compacte (tablette, telephone) : garder le lien actif visible dans la ligne qui defile
  useEffect(() => {
    const actif = document.querySelector<HTMLElement>('.sidebar nav a.actif');
    const nav = actif?.closest('nav');
    if (!actif || !nav || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollTo({ left: actif.offsetLeft - 24, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  // Inclinaison 3D des tuiles : suit le pointeur (une seule ecoute pour toute l'application)
  useEffect(() => {
    if (pathname !== '/accueil') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const survol = (e: PointerEvent) => {
      if (media.matches) return;
      const cible = (e.target as HTMLElement).closest<HTMLElement>(SELECTEUR_INCLINABLE);
      if (!cible) return;
      const r = cible.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cible.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
      cible.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg');
    };
    const reinitialiser = () => document.querySelectorAll<HTMLElement>(SELECTEUR_INCLINABLE).forEach(cible => { cible.style.removeProperty('--rx'); cible.style.removeProperty('--ry'); });
    media.addEventListener('change', reinitialiser);
    const sortie = (e: PointerEvent) => {
      const cible = (e.target as HTMLElement).closest<HTMLElement>(SELECTEUR_INCLINABLE);
      if (cible) { cible.style.setProperty('--rx', '0deg'); cible.style.setProperty('--ry', '0deg'); }
    };
    document.addEventListener('pointermove', survol);
    document.addEventListener('pointerout', sortie);
    return () => { document.removeEventListener('pointermove', survol); document.removeEventListener('pointerout', sortie); media.removeEventListener('change', reinitialiser); reinitialiser(); };
  }, [pathname]);
  const aujourdhui = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const page = LIENS.find(l => pathname.startsWith(l.vers))?.libelle;
  const groupe = GROUPES.find(g => g.vers.some(v => pathname.startsWith(v)))?.titre;
  const visibles = LIENS.filter(lien => lien.vers === '/audit' ? peutAudit(profil) : (['/finance', '/bi-finance', '/reclamations'].includes(lien.vers) ? peutFinance(profil) : peutOperations(profil)));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="marque">
          <span className="logo"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17l5-10 4 7 3-4 4 7" /></svg></span>
          <div>
            <strong>FleetPulse</strong>
            <small>Espace responsable</small>
          </div>
        </div>
        <nav aria-label="Navigation principale">
          {GROUPES.map((g) => {
            const liens = visibles.filter((lien) => g.vers.includes(lien.vers));
            if (liens.length === 0) return null;
            return (
              <div key={g.titre} className="groupe-nav">
                <span className="groupe-titre">{g.titre}</span>
                {liens.map((lien) => (
                  <NavLink key={lien.vers} to={lien.vers} className={({ isActive }) => (isActive ? 'actif' : '')}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={lien.icone} /></svg>
                    {lien.libelle}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="utilisateur">
          <div className="avatar">{profil?.prenom?.[0] ?? '?'}{profil?.nom?.[0] ?? ''}</div>
          <div className="utilisateur-infos">
            <strong>{profil?.prenom} {profil?.nom}</strong>
            <small>{profil?.sousRole ?? 'Administrateur principal'}</small>
          </div>
          <button className="bouton-icone" onClick={deconnexion} title="Se déconnecter" aria-label="Se déconnecter">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 17l5-5-5-5M20 12H9M12 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7" /></svg>
          </button>
        </div>
      </aside>
      <div className="zone-principale">
        <header className="barre">
          <span className="barre-fil">{groupe ? `${groupe} · ` : ''}<b>{page ?? 'Espace responsable'}</b></span>
          <div className="barre-droite">
            <span className="barre-date">{aujourdhui}</span>
            <span className="barre-pastille">{profil?.sousRole ?? 'Administrateur principal'}</span>
          </div>
        </header>
      <main className="contenu">
        <div key={pathname} className="page-entree">
          <Outlet />
        </div>
      </main>
      </div>
    </div>
  );
}
