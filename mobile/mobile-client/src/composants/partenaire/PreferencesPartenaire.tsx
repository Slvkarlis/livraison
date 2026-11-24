import { MouvementProvider, useAuth } from '@fleetpulse/shared';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { lirePreferences, sauverPreferences } from './stockagePreferences';

/** L'arabe et le RTL sont réservés au futur catalogue de traductions. */
export const LANGUES_PARTENAIRE = { fr: { libelle: 'Français', direction: 'ltr', disponible: true }, ar: { libelle: 'Arabe', direction: 'rtl', disponible: false } } as const;
type Preferences = { son: boolean; mouvementReduit: boolean; langue: 'fr' };
const DEFAUT: Preferences = { son: true, mouvementReduit: false, langue: 'fr' };
const Contexte = createContext<{ preferences: Preferences; pret: boolean; enregistrement: boolean; erreur: string | null; modifier: (maj: Partial<Preferences>) => Promise<void> } | null>(null);

export function PreferencesPartenaireProvider({ children }: { children: ReactNode }) {
  const { profil } = useAuth();
  const cle = `fleetpulse.partenaire.preferences.${profil?.id ?? 'anonyme'}`;
  const [preferences, setPreferences] = useState(DEFAUT);
  const [cleChargee, setCleChargee] = useState<string | null>(null);
  const pret = cleChargee === cle;
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const verrou = useRef(false);
  useEffect(() => {
    let actif = true;
    void lirePreferences(cle).then(texte => {
      if (!actif) return;
      let valeur: unknown = null;
      try { valeur = texte ? JSON.parse(texte) : null; } catch { /* Une préférence corrompue reprend ses valeurs par défaut. */ }
      const p = valeur && typeof valeur === 'object' ? valeur as Record<string, unknown> : {};
      setPreferences({ son: typeof p.son === 'boolean' ? p.son : true, mouvementReduit: p.mouvementReduit === true, langue: 'fr' });
    }).catch(() => { if (actif) setErreur('Préférences locales indisponibles.'); }).finally(() => { if (actif) setCleChargee(cle); });
    return () => { actif = false; };
  }, [cle]);
  async function modifier(maj: Partial<Preferences>) {
    if (!pret || verrou.current) return;
    verrou.current = true; setEnregistrement(true); setErreur(null);
    const avant = preferences, suivante = { ...avant, ...maj };
    setPreferences(suivante);
    try { await sauverPreferences(cle, JSON.stringify(suivante)); }
    catch { setPreferences(avant); setErreur('Réglage non enregistré. Réessayez : la valeur précédente est conservée.'); }
    finally { verrou.current = false; setEnregistrement(false); }
  }
  return <Contexte.Provider value={{ preferences, pret, enregistrement, erreur, modifier }}><MouvementProvider reduit={!pret || preferences.mouvementReduit}>{children}</MouvementProvider></Contexte.Provider>;
}
export function usePreferencesPartenaire() {
  const contexte = useContext(Contexte);
  if (!contexte) throw new Error('Préférences partenaire non initialisées.');
  return contexte;
}
