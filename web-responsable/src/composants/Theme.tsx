import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'clair' | 'sombre';
const CLE = 'fleetpulse.theme';
const ContexteTheme = createContext<{ theme: Theme; basculer: () => void }>({ theme: 'clair', basculer: () => {} });
function preference(): Theme | null { try { const valeur = localStorage.getItem(CLE); return valeur === 'clair' || valeur === 'sombre' ? valeur : null; } catch { return null; } }
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choix, setChoix] = useState<Theme | null>(preference);
  const [systeme, setSysteme] = useState<Theme>(() => matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair');
  const theme = choix ?? systeme;
  useEffect(() => { const media = matchMedia('(prefers-color-scheme: dark)'); const changer = () => setSysteme(media.matches ? 'sombre' : 'clair'); media.addEventListener('change', changer); return () => media.removeEventListener('change', changer); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const basculer = () => { const valeur = theme === 'clair' ? 'sombre' : 'clair'; setChoix(valeur); try { localStorage.setItem(CLE, valeur); } catch { /* Le thème reste disponible pour cet onglet. */ } };
  return <ContexteTheme.Provider value={{ theme, basculer }}>{children}</ContexteTheme.Provider>;
}
export function BasculeTheme() { const { theme, basculer } = useContext(ContexteTheme); return <button className="bouton-icone" type="button" onClick={basculer} aria-label={`Activer le mode ${theme === 'clair' ? 'sombre' : 'clair'}`} title={`Mode ${theme === 'clair' ? 'sombre' : 'clair'}`}>{theme === 'clair' ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}</button>; }
