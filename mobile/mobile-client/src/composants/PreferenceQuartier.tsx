import { useCallback, useState } from 'react';
import { Text, View, Switch } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, MessageErreur, type PreferenceQuartier as Preference } from '@fleetpulse/shared';

export function PreferenceQuartier() {
  const [preference, setPreference] = useState<Preference | null>(null);
  const [erreur, setErreur] = useState<string | null>(null), [envoi, setEnvoi] = useState(false);
  useFocusEffect(useCallback(() => { api.preferenceQuartier().then(setPreference).catch(e => setErreur(e.message)); }, []));
  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ flex: 1, color: '#5B21B6' }}>Invitations de quartier · 2 par jour maximum</Text>
      <Switch accessibilityLabel="Recevoir les invitations de quartier" disabled={!preference || envoi} value={preference?.recevoirInvitationsQuartier ?? false}
        onValueChange={v => { setEnvoi(true); api.definirPreferenceQuartier(v).then(p => { setPreference(p); setErreur(null); }).catch(e => setErreur(e.message)).finally(() => setEnvoi(false)); }} />
    </View><MessageErreur message={erreur} />
  </View>;
}
