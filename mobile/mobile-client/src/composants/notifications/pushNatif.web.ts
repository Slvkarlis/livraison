// US-304, version web : pas de push Expo dans le navigateur ; le client a le bandeau temps reel de l'application.
export async function enregistrerPush(): Promise<string | null> {
  return null;
}

export function ecouterTouches(_fn: (commandeId: number) => void, _ouvrirQuartier?: () => void): () => void {
  return () => {};
}
