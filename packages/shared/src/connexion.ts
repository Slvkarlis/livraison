import { useState } from 'react';
import { useAuth } from './auth';

/** Logique du formulaire de connexion (US-01) ; chaque application dessine son propre ecran. */
export function useConnexion() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function seConnecter() {
    if (!email.trim() || !motDePasse) {
      setErreur('Saisissez votre email et votre mot de passe.');
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      await login(email, motDePasse);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Connexion impossible.');
      setEnvoi(false);
    }
  }

  return { email, setEmail, motDePasse, setMotDePasse, erreur, envoi, seConnecter };
}
