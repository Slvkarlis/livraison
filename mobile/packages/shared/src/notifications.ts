// Sprint 3 : notifications de suivi de commande (US-304), miroir de NotificationDto.java.
import type { StatutLivraison } from './types';

export interface NotificationCommande {
  id: number; commandeId: number | null; statut: StatutLivraison | null;
  titre: string; message: string; creeLe: string; lue: boolean;
}
export interface BoiteNotifications { nonLues: number; notifications: NotificationCommande[] }

/** Message temps reel /user/queue/notifications ; null si le message est illisible. */
export function lireNotification(corps: string): NotificationCommande | null {
  try {
    const n = JSON.parse(corps) as Partial<NotificationCommande>;
    if (typeof n.id !== 'number' || typeof n.titre !== 'string' || typeof n.message !== 'string') return null;
    return {
      id: n.id, commandeId: typeof n.commandeId === 'number' ? n.commandeId : null, statut: n.statut ?? null,
      titre: n.titre, message: n.message, creeLe: n.creeLe ?? '', lue: n.lue === true,
    };
  } catch {
    return null;
  }
}

/** Duree d'affichage du bandeau dans l'application. */
export const DUREE_BANDEAU_MS = 6000;

/** commandeId venu des donnees d'une notification push touchee (nombre, ou texte selon la plateforme). */
export function commandeDuPush(donnees: unknown): number | null {
  if (!donnees || typeof donnees !== 'object') return null;
  const id = Number((donnees as { commandeId?: unknown }).commandeId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function creerApiNotifications(request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {
  return {
    notifications: () => request<BoiteNotifications>('GET', '/api/notifications'),
    marquerNotificationsLues: () => request<void>('PUT', '/api/notifications/lues'),
    enregistrerAppareil: (jeton: string) => request<void>('PUT', '/api/notifications/appareil', { jeton }),
    retirerAppareil: (jeton: string) => request<void>('DELETE', '/api/notifications/appareil', { jeton }),
  };
}
