import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alerte } from '../composants/ui';
import { useSession } from '../session';

// US-01
export default function Connexion() {
  const { connexion } = useSession();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await connexion(email, motDePasse);
    } catch (err) {
      setErreur((err as Error).message);
      setEnvoi(false);
    }
  }

  return (
    <div className="page-connexion">
      <form className="carte-connexion" onSubmit={soumettre}>
        <div className="marque">
          <span className="logo">F</span>
          <div>
            <strong>FleetPulse</strong>
            <small>Espace responsable</small>
          </div>
        </div>
        <h1>Connexion</h1>
        <p className="discret">Gérez les livreurs, les véhicules et suivez les commandes.</p>

        {erreur && <Alerte message={erreur} />}

        <label className="champ">
          <span>Email ou téléphone</span>
          <input type="text" autoComplete="username" required autoFocus value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="admin@fleetpulse.tn" />
        </label>
        <label className="champ">
          <span>Mot de passe</span>
          <input type="password" autoComplete="current-password" required value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)} />
        </label>
        <button className="bouton plein" type="submit" disabled={envoi}>
          {envoi ? 'Connexion…' : 'Se connecter'}
        </button>
        <p><Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link></p>
      </form>
    </div>
  );
}
