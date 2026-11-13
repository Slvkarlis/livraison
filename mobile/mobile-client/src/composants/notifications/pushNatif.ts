import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { commandeDuPush } from '@fleetpulse/shared';

// US-304 : push Expo sur telephone. Necessite un build de developpement (pas Expo Go) et un projectId EAS :
// sans eux, enregistrerPush renvoie null et le client garde le bandeau dans l'application.

// Application ouverte : le bandeau de l'application suffit, pas de doublon systeme
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Meme identifiant que channelId envoye par ExpoPushSender.java. */
const CANAL = 'commandes';

export async function enregistrerPush(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  try {
    // Android 13+ : le canal doit exister avant la demande d'autorisation et le jeton
    if (Platform.OS === 'android') {
      // AndroidImportance est bien exporte (index.d.ts) ; la regle lit le JS compile et ne le voit pas
      // eslint-disable-next-line import/namespace
      await Notifications.setNotificationChannelAsync(CANAL, { name: 'Suivi des commandes', importance: Notifications.AndroidImportance.HIGH });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return null;
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;   // Expo Go, simulateur sans services, reseau : l'application fonctionne sans push
  }
}

/** Notification touchee (application ouverte ou lancee par elle) : fn(commandeId). */
export function ecouterTouches(fn: (commandeId: number) => void): () => void {
  const traiter = (r: Notifications.NotificationResponse | null) => {
    if (!r || r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = commandeDuPush(r.notification.request.content.data);
    if (id) fn(id);
  };
  void Notifications.getLastNotificationResponseAsync().then((r) => {
    traiter(r);
    void Notifications.clearLastNotificationResponseAsync();
  }).catch(() => {});
  const abonnement = Notifications.addNotificationResponseReceivedListener(traiter);
  return () => abonnement.remove();
}
