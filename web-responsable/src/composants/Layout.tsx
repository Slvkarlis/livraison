import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../session';
import { peutFinance, peutOperations } from '../sprint1';

const LIENS = [
  { vers: '/bi-finance', libelle: 'BI Finance', icone: 'M4 20V10M10 20V4M16 20v-8M22 20H2' },
  { vers: '/bi-operations', libelle: 'BI Opérations', icone: 'M4 20V10M10 20V4M16 20v-8M22 20H2' },
  { vers: '/bi-partenaires', libelle: 'BI Partenaires', icone: 'M4 20V10M10 20V4M16 20v-8M22 20H2' },
  { vers: '/bi-coursiers', libelle: 'BI Coursiers', icone: 'M4 20V10M10 20V4M16 20v-8M22 20H2' },
  { vers: '/zones', libelle: 'Zones et frais', icone: 'M3 3l6 3 6-3 6 3v15l-6-3-6 3-6-3zM9 6v15M15 3v15' },
  { vers: '/dossiers', libelle: 'Dossiers', icone: 'M4 4h16v16H4zM8 8h8M8 12h8' },
  { vers: '/comptes', libelle: 'Comptes', icone: 'M4 6h16M4 12h16M4 18h10' },
  { vers: '/audit', libelle: 'Journal d’audit', icone: 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h4' },
  { vers: '/commandes', libelle: 'Commandes', icone: 'M4 6h16M4 12h16M4 18h10' },
  { vers: '/finance', libelle: 'Finance', icone: 'M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6' },
  { vers: '/dispatch', libelle: 'Dispatch', icone: 'M5 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm14-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 15l10-8M5 13V5h6' },
  { vers: '/livreurs', libelle: 'Livreurs', icone: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0' },
  { vers: '/echecs', libelle: 'Échecs de livraison', icone: 'M12 9v4m0 4h.01M4.9 19h14.2L12 5 4.9 19z' },
  { vers: '/reclamations', libelle: 'Réclamations', icone: 'M4 4h16v12H8l-4 4z' },
  { vers: '/pilote', libelle: 'Pilote', icone: 'M3 17l6-6 4 4 8-8M14 7h7v7' },
  { vers: '/previsions', libelle: 'Prévisions', icone: 'M4 19V5m0 14h16M8 15l3-4 3 2 5-6' },
  { vers: '/vehicules', libelle: 'Véhicules', icone: 'M3 13l2-6h11l3 6v4h-2M3 13v4h2m0 0a2 2 0 1 0 4 0m-4 0a2 2 0 1 1 4 0m0 0h6m0 0a2 2 0 1 0 4 0m-4 0a2 2 0 1 1 4 0M3 13h16' },
];

const GROUPES: { titre: string; vers: string[] }[] = [
  { titre: 'Pilotage', vers: ['/bi-finance', '/bi-operations', '/bi-partenaires', '/bi-coursiers'] },
  { titre: 'Opérations', vers: ['/commandes', '/dispatch', '/echecs', '/zones', '/livreurs', '/vehicules', '/pilote', '/previsions'] },
  { titre: 'Finance', vers: ['/finance', '/reclamations'] },
  { titre: 'Administration', vers: ['/dossiers', '/comptes', '/audit'] },
];

export default function Layout() {
  const { profil, deconnexion } = useSession();
  const aujourdhui = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const visibles = LIENS.filter(lien => lien.vers === '/audit' || (['/finance', '/bi-finance'].includes(lien.vers) ? peutFinance(profil) : peutOperations(profil)));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="marque">
          <span className="logo">F</span>
          <div>
            <strong>FleetPulse</strong>
            <small>Espace responsable</small>
          </div>
        </div>
        <nav>
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
          <div>
            <span className="barre-date">{aujourdhui}</span>
            <strong className="barre-bonjour">Bonjour {profil?.prenom ?? ''}</strong>
          </div>
          <span className="barre-pastille">{profil?.sousRole ?? 'Administrateur principal'}</span>
        </header>
      <main className="contenu en-entree">
        <Outlet />
      </main>
      </div>
    </div>
  );
}
