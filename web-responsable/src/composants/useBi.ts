import { useCallback, useState } from 'react';
import { filtreBi, periodeParDefaut } from '../../../mobile/packages/shared/src/bi';
import { useDonnees } from './ui';

export function useBi<T>(api: (query: string) => Promise<T>) {
  const initial = periodeParDefaut();
  const [debut, setDebut] = useState(initial.debut), [fin, setFin] = useState(initial.fin), [zone, setZone] = useState('');
  const [query, setQuery] = useState(filtreBi(initial.debut, initial.fin));
  const charger = useCallback(() => api(query), [api, query]);
  const donnees = useDonnees(charger);
  const appliquer = () => { const q = filtreBi(debut, fin, zone); if (q === query) void donnees.recharger(); else setQuery(q); };
  return { ...donnees, debut, fin, zone, setDebut, setFin, setZone, appliquer };
}
