import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';
import { pageHtml, SOURCE_CARTE, type CarteLeafletProps, type CarteLeafletRef, type MessageCarte } from './carteLeafletPage';

/**
 * Version navigateur de CarteLeaflet (apercu Expo web) : react-native-webview n'existe pas en web,
 * la meme page Leaflet est donc affichee dans une iframe srcdoc.
 */

export type { CarteLeafletRef, Point } from './carteLeafletPage';

type FenetreCarte = Window & {
  allerA?: (latitude: number, longitude: number, zoom: number | null) => void;
  afficherMaPosition?: (latitude: number, longitude: number) => void;
};

export const CarteLeaflet = forwardRef<CarteLeafletRef, CarteLeafletProps>(function CarteLeaflet(
  { centre, zoom = 16, interactive = true, marqueur = false, onDeplacementDebut, onDeplacementFin, onPret, style },
  ref,
) {
  const cadre = useRef<HTMLIFrameElement>(null);
  const [etat, setEtat] = useState<'chargement' | 'pret' | 'erreur'>('chargement');
  const rappels = useRef({ onDeplacementDebut, onDeplacementFin, onPret });
  rappels.current = { onDeplacementDebut, onDeplacementFin, onPret };

  // La page n'est construite qu'une fois, comme sur mobile.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => pageHtml(centre, zoom, interactive, marqueur), []);

  // srcdoc partage l'origine de la page : les fonctions de la carte sont appelees directement.
  const fenetre = () => cadre.current?.contentWindow as FenetreCarte | null | undefined;
  useImperativeHandle(ref, () => ({
    allerA: ({ latitude, longitude }, niveau) => fenetre()?.allerA?.(latitude, longitude, niveau ?? null),
    afficherMaPosition: ({ latitude, longitude }) => fenetre()?.afficherMaPosition?.(latitude, longitude),
  }), []);

  useEffect(() => {
    function surMessage(event: MessageEvent) {
      if (event.source !== cadre.current?.contentWindow) return;
      const message = event.data as (MessageCarte & { source?: string }) | null;
      if (!message || message.source !== SOURCE_CARTE) return;
      if (message.type === 'pret') {
        setEtat('pret');
        rappels.current.onPret?.();
      } else if (message.type === 'erreur') {
        setEtat('erreur');
      } else if (message.type === 'debut') {
        rappels.current.onDeplacementDebut?.();
      } else {
        rappels.current.onDeplacementFin?.({ latitude: message.latitude, longitude: message.longitude });
      }
    }
    window.addEventListener('message', surMessage);
    return () => window.removeEventListener('message', surMessage);
  }, []);

  return (
    <View style={[styles.conteneur, style]}>
      <iframe
        ref={cadre}
        srcDoc={html}
        title="Carte"
        style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
      />
      {etat !== 'pret' ? (
        <View pointerEvents="none" style={styles.voile}>
          <Text style={styles.voileTexte}>
            {etat === 'erreur' ? 'Carte indisponible : vérifiez la connexion internet.' : 'Chargement de la carte…'}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  conteneur: { overflow: 'hidden', backgroundColor: '#ECEAF4' },
  voile: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECEAF4',
    padding: 24,
  },
  voileTexte: { fontSize: 14, color: theme.secondaire, textAlign: 'center' },
});
