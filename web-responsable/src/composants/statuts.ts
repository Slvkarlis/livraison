import type { Livraison, StatutLivraison } from '../types';
import type { Ton, Etape } from './luxe';

export const EN_COURS: StatutLivraison[] = ['ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'AFFECTEE', 'RECUPEREE', 'EN_COURS', 'A_PROXIMITE', 'ARRIVEE'];
export const EN_ROUTE: StatutLivraison[] = ['RECUPEREE', 'EN_COURS', 'A_PROXIMITE', 'ARRIVEE'];

export function tonStatut(s: StatutLivraison): Ton {
  if (s === 'LIVREE') return 'succes';
  if (s === 'ECHEC' || s === 'REFUSEE' || s === 'ANNULEE') return 'danger';
  if (s === 'PENDING_PARTNER' || s === 'RETOURNEE') return 'neutre';
  return 'accent';
}

/** Avancement du trajet de 0 a 1 selon l'etape. */
export function progression(s: StatutLivraison): number {
  return ({ AFFECTEE: .12, RECUPEREE: .3, EN_COURS: .55, A_PROXIMITE: .8, ARRIVEE: .94, LIVREE: 1 } as Partial<Record<StatutLivraison, number>>)[s] ?? 0;
}

export const heure = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';

export const initiale = (l: Livraison) => (l.nomPartenaire ?? l.clientEmail ?? '?').trim().charAt(0) || '?';

const ORDRE: StatutLivraison[] = ['PENDING_PARTNER', 'ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'AFFECTEE', 'RECUPEREE', 'EN_COURS', 'A_PROXIMITE', 'ARRIVEE', 'LIVREE'];

/** Frise d'etapes deduite du statut courant. */
export function etapesCommande(l: Livraison): Etape[] {
  const rang = ORDRE.indexOf(l.statut);
  const echec = ['ECHEC', 'REFUSEE', 'ANNULEE', 'RETOURNEE'].includes(l.statut);
  const jalons: { titre: string; detail: string; jusqua: StatutLivraison }[] = [
    { titre: 'Commande créée', detail: `${heure(l.dateCreation)} · ${l.nomPartenaire ?? 'commande directe'}`, jusqua: 'PENDING_PARTNER' },
    { titre: 'Acceptée et préparée', detail: l.nomPartenaire ? 'Par le commerce' : 'Prise en charge', jusqua: 'PRETE' },
    { titre: 'Colis récupéré', detail: 'Le livreur a quitté le commerce', jusqua: 'RECUPEREE' },
    { titre: 'En route vers le client', detail: l.adresse, jusqua: 'ARRIVEE' },
    { titre: 'Remise au client', detail: 'Avec le code de remise', jusqua: 'LIVREE' },
  ];
  const etapes: Etape[] = jalons.map((j, i) => {
    const fin = ORDRE.indexOf(j.jusqua);
    const debut = i === 0 ? 0 : ORDRE.indexOf(jalons[i - 1].jusqua) + 1;
    const etat: Etape['etat'] = rang > fin || l.statut === 'LIVREE' ? 'fait' : rang >= debut && rang <= fin ? (i === 0 && rang === 0 ? 'encours' : 'encours') : 'avenir';
    return { titre: j.titre, detail: j.detail, etat };
  });
  if (echec) {
    const libelle = { ECHEC: 'Échec de livraison', REFUSEE: 'Refusée par le commerce', ANNULEE: 'Commande annulée', RETOURNEE: 'Retournée au commerce' }[l.statut as 'ECHEC'];
    return [...etapes.filter(e => e.etat === 'fait'), { titre: libelle, detail: 'Voir les interventions ci-dessous', etat: 'echec' }];
  }
  return etapes;
}
