import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CarteVille3D } from '../composants/CarteVille3D';
import { FriseTrajet } from '../composants/luxe';
import { Alerte } from '../composants/ui';
import { useSession } from '../session';

// US-01 : ville nocturne en 3D a gauche, formulaire a droite
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
      <section className="connexion-scene" aria-hidden="true">
        <CarteVille3D />
        <div className="marque">
          <span className="logo"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17l5-10 4 7 3-4 4 7" /></svg></span>
          <div><strong>FleetPulse</strong><small>Livraison urbaine · Tunis</small></div>
        </div>
        <h2>Toute la ville, <em>en un regard.</em></h2>
        <p>Commandes, livreurs, zones et finances suivis en direct, de la prise de commande à la remise.</p>
        <div className="connexion-frise">
          <FriseTrajet depart="19:31" arrivee="19:47" duree="16 min" de="Commerce" vers="Client" distance="3,2 km" progression={0.55} />
        </div>
      </section>

      <div className="connexion-cote">
        <form className="carte-connexion" onSubmit={soumettre}>
          <h1>Connexion</h1>
          <p className="discret">Espace responsable : opérations, finance et administration.</p>

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
            {envoi ? 'Connexion…' : <>Se connecter <span className="fleche" aria-hidden="true">→</span></>}
          </button>
          <p><Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link></p>
        </form>
      </div>
    </div>
  );
}
