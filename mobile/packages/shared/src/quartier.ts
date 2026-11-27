export interface GroupeQuartierProche {
  id: number; commerceId: number; commerce: string; nbMembres: number; reduction: number;
  fraisLivraison: number; expiration: string; secondesRestantes: number;
}
export interface PreferenceQuartier { recevoirInvitationsQuartier: boolean }
export function creerApiQuartier(request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {
  return {
    carteQuartier: () => request<{ active: boolean }>('GET', '/api/quartier/carte'),
    confirmerCarteQuartier: (id: number) => request<import('./types').Livraison>('POST', '/api/commandes/' + id + '/carte/confirmer'),
    groupesQuartierProches: (adresseId: number) => request<GroupeQuartierProche[]>('GET', '/api/quartier/groupes-proches?adresseId=' + adresseId),
    preferenceQuartier: () => request<PreferenceQuartier>('GET', '/api/quartier/preference'),
    definirPreferenceQuartier: (recevoirInvitationsQuartier: boolean) => request<PreferenceQuartier>('PUT', '/api/quartier/preference', { recevoirInvitationsQuartier }),
  };
}
