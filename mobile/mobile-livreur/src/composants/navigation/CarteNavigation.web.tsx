import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { pageNavigation, SOURCE_NAVIGATION, type EtatNavigation, type MessageNavigation } from './carteNavigationPage';
import { BoutonsCarte, VoileCarte, styles, type CarteNavigationProps } from './commun';

type FenetreNavigation = Window & {
  majNavigation?: (etat: EtatNavigation) => void;
  recentrer?: () => void;
  vueEnsemble?: () => void;
};

/** Version navigateur (apercu Expo web) : react-native-webview n'existe pas en web, la page est dans une iframe. */
export function CarteNavigation({ etat, style }: CarteNavigationProps) {
  const cadre = useRef<HTMLIFrameElement>(null);
  const [statut, setStatut] = useState<'chargement' | 'pret' | 'erreur'>('chargement');
  const [libre, setLibre] = useState(false);
  const html = useMemo(() => pageNavigation(), []);
  // srcdoc partage l'origine de la page : les fonctions de la carte sont appelees directement.
  const fenetre = () => cadre.current?.contentWindow as FenetreNavigation | null | undefined;

  useEffect(() => {
    function surMessage(event: MessageEvent) {
      if (event.source !== cadre.current?.contentWindow) return;
      const message = event.data as (MessageNavigation & { source?: string }) | null;
      if (!message || message.source !== SOURCE_NAVIGATION) return;
      if (message.type === 'pret') setStatut('pret');
      else if (message.type === 'erreur') setStatut('erreur');
      else setLibre(message.type === 'libre');
    }
    window.addEventListener('message', surMessage);
    return () => window.removeEventListener('message', surMessage);
  }, []);

  useEffect(() => {
    if (statut === 'pret' && etat) fenetre()?.majNavigation?.(etat);
  }, [etat, statut]);

  return (
    <View style={[styles.conteneur, style]}>
      <iframe ref={cadre} srcDoc={html} title="Carte de navigation" style={{ border: 0, width: '100%', height: '100%', display: 'block' }} />
      <BoutonsCarte libre={libre} onRecentrer={() => fenetre()?.recentrer?.()} onEnsemble={() => fenetre()?.vueEnsemble?.()} />
      <VoileCarte statut={statut} />
    </View>
  );
}
