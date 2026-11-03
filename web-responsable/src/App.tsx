import { useEffect, useState, type ReactNode } from 'react';
import Zones from './pages/Zones';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './composants/Layout';
import Commandes from './pages/Commandes';
import Connexion from './pages/Connexion';
import Livreurs from './pages/Livreurs';
import Vehicules from './pages/Vehicules';
import Comptes from './pages/Comptes';
import Audit from './pages/Audit';
import MotDePasseOublie from './pages/MotDePasseOublie';
import { useSession } from './session';
import { destination, peutAudit, peutOperations } from './sprint1';
import { api } from './api';
function Guard({ operations = false, children }: { operations?: boolean; children: ReactNode }) {
  const { profil } = useSession();
  return (operations ? peutOperations(profil) : peutAudit(profil)) ? children : <Navigate to="/acces-refuse" replace />;
}
export default function App() {
  const { profil, chargement } = useSession();
  const [demo, setDemo] = useState(false);
  const [erreurConfig, setErreurConfig] = useState(false);
  useEffect(() => { api.demo().then(c => setDemo(c.demonstration)).catch(() => setErreurConfig(true)); }, []);
  if (chargement) return <div className="plein-ecran"><span className="spinner" /></div>;
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
        <Route path="/zones" element={<Guard operations><Zones /></Guard>} />
        <Route path="/livreurs" element={<Guard operations><Livreurs /></Guard>} />
        <Route path="/vehicules" element={<Guard operations><Vehicules /></Guard>} />
        <Route path="/acces-refuse" element={refuse} />
      </Route>
      <Route path="*" element={<Navigate to={destination(profil)} replace />} />
    </Routes>}
  </>;
}
