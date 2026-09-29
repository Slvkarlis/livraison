import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './composants/Layout';
import Commandes from './pages/Commandes';
import Connexion from './pages/Connexion';
import Livreurs from './pages/Livreurs';
import Vehicules from './pages/Vehicules';
import { useSession } from './session';

export default function App() {
  const { profil, chargement } = useSession();

  if (chargement) return <div className="plein-ecran"><span className="spinner" /></div>;

  if (!profil) {
    return (
      <Routes>
        <Route path="/connexion" element={<Connexion />} />
        <Route path="*" element={<Navigate to="/connexion" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/commandes" element={<Commandes />} />
        <Route path="/livreurs" element={<Livreurs />} />
        <Route path="/vehicules" element={<Vehicules />} />
      </Route>
      <Route path="*" element={<Navigate to="/commandes" replace />} />
    </Routes>
  );
}
