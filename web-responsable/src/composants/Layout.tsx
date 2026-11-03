import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../session';
import { peutOperations } from '../sprint1';

const LIENS = [
  { vers: '/zones', libelle: 'Zones et frais', icone: 'M3 3l6 3 6-3 6 3v15l-6-3-6 3-6-3zM9 6v15M15 3v15' },
  { vers: '/dossiers', libelle: 'Dossiers', icone: 'M4 4h16v16H4zM8 8h8M8 12h8' },
  { vers: '/comptes', libelle: 'Comptes', icone: 'M4 6h16M4 12h16M4 18h10' },
  { vers: '/audit', libelle: 'Journal d’audit', icone: 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h4' },
  { vers: '/commandes', libelle: 'Commandes', icone: 'M4 6h16M4 12h16M4 18h10' },
  { vers: '/livreurs', libelle: 'Livreurs', icone: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0' },
  { vers: '/vehicules', libelle: 'Véhicules', icone: 'M3 13l2-6h11l3 6v4h-2M3 13v4h2m0 0a2 2 0 1 0 4 0m-4 0a2 2 0 1 1 4 0m0 0h6m0 0a2 2 0 1 0 4 0m-4 0a2 2 0 1 1 4 0M3 13h16' },
];

export default function Layout() {
  const { profil, deconnexion } = useSession();

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
          {LIENS.filter(lien => lien.vers === '/audit' || peutOperations(profil)).map((lien) => (
            <NavLink key={lien.vers} to={lien.vers} className={({ isActive }) => (isActive ? 'actif' : '')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={lien.icone} /></svg>
              {lien.libelle}
            </NavLink>
          ))}
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
      <main className="contenu">
        <Outlet />
      </main>
    </div>
  );
}
