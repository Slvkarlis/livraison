import { MotDePasseOublie } from '@fleetpulse/shared';
import { router } from 'expo-router';
export default function Ecran() { return <MotDePasseOublie retour={() => router.replace('/connexion')} />; }
