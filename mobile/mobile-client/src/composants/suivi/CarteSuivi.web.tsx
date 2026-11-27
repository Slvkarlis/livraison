import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { theme } from '../../theme';
import { pageSuivi, SOURCE_SUIVI, type EtatSuivi, type MessageSuivi } from './carteSuiviPage';
import { BoutonRecentrer, VoileSuivi, styles, type CarteSuiviProps } from './carteSuiviCommun';

type FenetreSuivi = Window & { majSuivi?: (etat: EtatSuivi) => void; recentrer?: () => void };

/** Version navigateur : react-native-webview n'existe pas en web, la meme page est dans une iframe srcdoc. */
export function CarteSuivi({ etat, style }: CarteSuiviProps) {
  const cadre = useRef<HTMLIFrameElement>(null);
  const [statut, setStatut] = useState<'chargement' | 'pret' | 'erreur'>('chargement');
  const [libre, setLibre] = useState(false);
  const html = useMemo(() => pageSuivi(theme.accent), []);
  const fenetre = () => cadre.current?.contentWindow as FenetreSuivi | null | undefined;

  useEffect(() => {
    function surMessage(event: MessageEvent) {
      if (event.source !== cadre.current?.contentWindow) return;
      const message = event.data as (MessageSuivi & { source?: string }) | null;
      if (!message || message.source !== SOURCE_SUIVI) return;
      if (message.type === 'pret') setStatut('pret');
      else if (message.type === 'erreur') setStatut('erreur');
      else setLibre(message.type === 'libre');
    }
    window.addEventListener('message', surMessage);
    return () => window.removeEventListener('message', surMessage);
  }, []);

  useEffect(() => {
    if (statut === 'pret' && etat) fenetre()?.majSuivi?.(etat);
  }, [etat, statut]);

  return (
    <View style={[styles.conteneur, style]}>
      <iframe ref={cadre} srcDoc={html} title="Suivi du livreur" style={{ border: 0, width: '100%', height: '100%', display: 'block' }} />
      <BoutonRecentrer visible={libre} onPress={() => fenetre()?.recentrer?.()} />
      <VoileSuivi statut={statut} />
    </View>
  );
}
