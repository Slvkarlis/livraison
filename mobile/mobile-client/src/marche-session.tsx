import { createContext, useContext, useState, type ReactNode } from 'react';
import { panierVide, type Panier, type PanierEnvoi } from '@fleetpulse/shared';
type SessionMarche = { panier: Panier; changer: (p: Panier) => void; attente: PanierEnvoi | null; confirmer: (p: PanierEnvoi | null) => void };
const Context = createContext<SessionMarche | null>(null);
export function MarcheSession({ children }: { children: ReactNode }) {
  const [panier, changer] = useState(panierVide);
  const [attente, confirmer] = useState<PanierEnvoi | null>(null);
  return <Context.Provider value={{ panier, changer, attente, confirmer }}>{children}</Context.Provider>;
}
export function useMarche() {
  const s = useContext(Context);
  if (!s) throw new Error('Session catalogue absente.');
  return s;
}
