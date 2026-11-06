import { Bouton } from '@fleetpulse/shared';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';

// US-2B9 : camera plein ecran qui lit le QR de l'etiquette du colis
export function ScannerQr({ onScan, onFermer }: { onScan: (contenu: string) => void; onFermer: () => void }) {
  const [permission, demanderPermission] = useCameraPermissions();
  // La camera signale le meme QR plusieurs fois par seconde : seule la premiere lecture compte
  const dejaLu = useRef(false);

  if (!permission) return <View style={styles.page} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.page, styles.centre]}>
        <Text style={styles.texte}>L’appareil photo est nécessaire pour scanner le QR du colis.</Text>
        <Bouton titre="Autoriser l’appareil photo" onPress={() => void demanderPermission()} />
        <Bouton titre="Saisir le code à la place" variante="discret" onPress={onFermer} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.page}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={(resultat) => {
          if (dejaLu.current) return;
          dejaLu.current = true;
          onScan(resultat.data);
        }}
      />
      <SafeAreaView style={styles.surcouche} pointerEvents="box-none">
        <Text style={styles.consigne}>Visez le QR collé sur le colis</Text>
        <View style={styles.cible} />
        <Bouton titre="Annuler" variante="secondaire" onPress={onFermer} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000' },
  centre: { justifyContent: 'center', padding: 24, gap: 16, backgroundColor: theme.fond },
  texte: { fontSize: 16, color: theme.texte, textAlign: 'center' },
  surcouche: { flex: 1, justifyContent: 'space-between', alignItems: 'stretch', padding: 24 },
  consigne: { fontSize: 17, fontWeight: '700', color: '#fff', textAlign: 'center', marginTop: 12 },
  cible: { alignSelf: 'center', width: 240, height: 240, borderRadius: 16, borderWidth: 3, borderColor: theme.accent },
});
