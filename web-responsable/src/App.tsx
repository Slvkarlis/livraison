import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
const Zones = lazy(() => import('./pages/Zones'));
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './composants/Layout';
const Commandes = lazy(() => import('./pages/Commandes'));
const Connexion = lazy(() => import('./pages/Connexion'));
const Livreurs = lazy(() => import('./pages/Livreurs'));
const Vehicules = lazy(() => import('./pages/Vehicules'));
const Echecs = lazy(() => import('./pages/Echecs'));
const Reclamations = lazy(() => import('./pages/Reclamations'));
const Pilote = lazy(() => import('./pages/Pilote'));
const Previsions = lazy(() => import('./pages/Previsions'));
const Prospection = lazy(() => import('./pages/Prospection'));
const Accueil = lazy(() => import('./pages/Accueil'));
const Simulateur = lazy(() => import('./pages/Simulateur'));
const Comptes = lazy(() => import('./pages/Comptes'));
const Audit = lazy(() => import('./pages/Audit'));
const Dispatch = lazy(() => import('./pages/Dispatch'));
const Finance = lazy(() => import('./pages/Finance'));
const BiFinance = lazy(() => import('./pages/BiFinance'));
const BiOperations = lazy(() => import('./pages/BiOperations'));
const BiPartenaires = lazy(() => import('./pages/BiPartenaires'));
const BiCoursiers = lazy(() => import('./pages/BiCoursiers'));
const MotDePasseOublie = lazy(() => import('./pages/MotDePasseOublie'));
import { useSession } from './session';
import { destination, peutAudit, peutFinance, peutOperations } from './sprint1';
import { api } from './api';
const SuiviLive = lazy(() => import('./pages/SuiviLive'));
function Guard({ operations = false, finance = false, children }: { operations?: boolean; finance?: boolean; children: ReactNode }) {
  const { profil } = useSession();
  const autorise = operations ? peutOperations(profil) : finance ? peutFinance(profil) : peutAudit(profil);
  return autorise ? children : <Navigate to="/acces-refuse" replace />;
}
export default function App() {
  const { profil, chargement } = useSession();
  const [demo, setDemo] = useState(false);
  const [erreurConfig, setErreurConfig] = useState(false);
  useEffect(() => { api.demo().then(c => setDemo(c.demonstration)).catch(() => setErreurConfig(true)); }, []);
  if (chargement) return <div className="plein-ecran" role="status" aria-label="Chargement de votre session"><span className="spinner" /></div>;
  const refuse = <div className="etat"><h1>Accès refusé</h1><p>Votre rôle ne permet pas d’accéder à cette page.</p><Link to={profil ? destination(profil) : '/connexion'}>Revenir à mon espace</Link></div>;
  return <>
    {demo && <div className="bandeau" role="status">Mode démonstration — codes disponibles dans les logs backend.</div>}
    {erreurConfig && <div className="bandeau" role="alert">Configuration du serveur indisponible. <button onClick={() => { api.demo().then(c => { setDemo(c.demonstration); setErreurConfig(false); }).catch(() => {}); }}>Réessayer</button></div>}
    {!profil ? <Routes>
      <Route path="/connexion" element={<Connexion />} />
      <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
      <Route path="/acces-refuse" element={refuse} />
      <Route path="*" element={<Navigate to="/connexion" replace />} />
    </Routes> : <Routes>
      <Route element={<Guard><Layout /></Guard>}>
        <Route path="/dossiers" element={<Guard operations><Comptes dossiers /></Guard>} />
        <Route path="/comptes" element={<Guard operations><Comptes /></Guard>} />
        <Route path="/audit" element={<Guard><Audit /></Guard>} />
        <Route path="/commandes" element={<Guard operations><Commandes /></Guard>} />
        <Route path="/dispatch" element={<Guard operations><Dispatch /></Guard>} />
        <Route path="/suivi-live" element={<Guard operations><Suspense fallback={<div className="etat" role="status">Chargement du suivi en direct…</div>}><SuiviLive /></Suspense></Guard>} />
        <Route path="/finance" element={<Guard finance><Finance /></Guard>} />
        <Route path="/bi-finance" element={<Guard finance><BiFinance /></Guard>} />
        <Route path="/bi-operations" element={<Guard operations><BiOperations /></Guard>} />
        <Route path="/bi-partenaires" element={<Guard operations><BiPartenaires /></Guard>} />
        <Route path="/bi-coursiers" element={<Guard operations><BiCoursiers /></Guard>} />
        <Route path="/zones" element={<Guard operations><Zones /></Guard>} />
        <Route path="/livreurs" element={<Guard operations><Livreurs /></Guard>} />
        <Route path="/vehicules" element={<Guard operations><Vehicules /></Guard>} />
        <Route path="/accueil" element={<Guard operations><Accueil /></Guard>} />
        <Route path="/echecs" element={<Guard operations><Echecs /></Guard>} />
        <Route path="/reclamations" element={<Guard finance><Reclamations /></Guard>} />
        <Route path="/pilote" element={<Guard operations><Pilote /></Guard>} />
        <Route path="/previsions" element={<Guard operations><Previsions /></Guard>} />
        <Route path="/prospection" element={<Guard operations><Prospection /></Guard>} />
        <Route path="/simulateur" element={<Guard operations><Simulateur /></Guard>} />
        <Route path="/acces-refuse" element={refuse} />
      </Route>
      <Route path="*" element={<Navigate to={destination(profil)} replace />} />
    </Routes>}
  </>;
}

