import { Bouton, EcranConnexion } from '@fleetpulse/shared';
import { router } from 'expo-router';

// US-01
export default function Connexion() {
  return (
    <EcranConnexion
      sousTitre="Passez et suivez vos commandes."
      piedDePage={
        <Bouton titre="Créer un compte" variante="discret" onPress={() => router.push('/inscription')} />
      }
    />
  );
}
