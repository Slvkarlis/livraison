import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { api, ApiError } from './api';
import { useAuth } from './auth';
import { Bouton, Champ, MessageErreur, Titre, useTheme } from './ui';
import { candidatureVide, codeValide, motDePasseValide, payloadCandidature, STATUTS_COMPTE,
  telephoneValide, verifierCandidature, verifierIdentite, type Compte, type FormCandidature } from './sprint1';

const Configuration = createContext({ demonstration: false, delaiRenvoiSecondes: 60 });
/** Configuration publique du serveur (mode demonstration, delai de renvoi des codes). */
export function useConfiguration() { return useContext(Configuration); }
export function ConfigurationProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState({ demonstration: false, delaiRenvoiSecondes: 60 });
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(async () => {
    try { setConfig(await api.demo()); setErreur(null); }
    catch (e) { setErreur((e as Error).message); }
  }, []);
  useEffect(() => {
    void api.demo().then(setConfig).catch(e => setErreur((e as Error).message));
  }, []);
  return <Configuration.Provider value={config}>
    {config.demonstration && <Text accessibilityRole="alert" style={{ padding: 12, color: '#78350F', backgroundColor: '#FEF3C7' }}>Mode démonstration — codes disponibles dans les logs backend.</Text>}
    {erreur && <View><MessageErreur message={erreur} /><Bouton titre="Réessayer la configuration" onPress={() => void charger()} /></View>}
    {children}
  </Configuration.Provider>;
}
function Page({ titre, children }: { titre: string; children: ReactNode }) {
  const t = useTheme();
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.fond }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
      <Titre>{titre}</Titre>{children}
    </ScrollView>
  </KeyboardAvoidingView>;
}
function Info({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text accessibilityLiveRegion="polite" style={{ color: t.texte, lineHeight: 24 }}>{children}</Text>;
}
function useCompteARebours() {
  const { delaiRenvoiSecondes } = useContext(Configuration);
  const [fin, setFin] = useState(0);
  const [secondes, setSecondes] = useState(0);
  useEffect(() => {
    const actualiser = () => setSecondes(Math.max(0, Math.ceil((fin - Date.now()) / 1000)));
    actualiser(); const id = setInterval(actualiser, 500);
    return () => clearInterval(id);
  }, [fin]);
  return { secondes, demarrer: () => { setSecondes(delaiRenvoiSecondes); setFin(Date.now() + delaiRenvoiSecondes * 1000); } };
}
const champsIdentite = [['prenom', 'Prénom'], ['nom', 'Nom'], ['email', 'Email'],
  ['telephone', 'Téléphone international (+216…)'], ['motDePasse', 'Mot de passe (8 caractères minimum)']] as const;
const champsPartenaire = [['nomCommerce', 'Nom du commerce'], ['categorie', 'Catégorie'], ['adresse', 'Adresse'],
  ['latitude', 'Latitude (-90 à 90)'], ['longitude', 'Longitude (-180 à 180)'], ['matriculeFiscal', 'Matricule fiscal']] as const;
const champsLivreur = [['numeroIdentite', "Numéro de pièce d’identité"], ['vehiculeDeclare', 'Véhicule (type, immatriculation)']] as const;
function ChampsDossier({ form, setForm, champs, bloque = false }: {
  form: FormCandidature; setForm: (f: FormCandidature) => void;
  champs: readonly (readonly [keyof FormCandidature, string])[]; bloque?: boolean;
}) {
  return <>{champs.map(([key, label]) => <Champ key={key} libelle={label} value={form[key]} editable={!bloque}
    onChangeText={v => setForm({ ...form, [key]: v })} secureTextEntry={key === 'motDePasse'}
    accessibilityLabel={label} autoCapitalize={key === 'email' || key === 'motDePasse' ? 'none' : 'sentences'}
    keyboardType={key === 'telephone' ? 'phone-pad' : key === 'email' ? 'email-address' : 'default'} />)}</>;
}
export function InscriptionOtp() {
  const { ouvrir } = useAuth();
  const [form, setForm] = useState({ ...candidatureVide });
  const [etape, setEtape] = useState(false);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const { secondes, demarrer } = useCompteARebours();
  async function envoyer() {
    if (envoi || secondes) return;
    if (!telephoneValide(form.telephone)) { setErreur('Téléphone international invalide, par exemple +21620123456.'); return; }
    setEnvoi(true); setErreur(null);
    try { await api.demanderOtp(form.telephone.trim()); demarrer(); setEtape(true); setCode(''); }
    catch (e) { setErreur((e as Error).message); if (e instanceof ApiError && e.status === 429) demarrer(); }
    finally { setEnvoi(false); }
  }
  async function verifier() {
    const message = verifierIdentite(form) ?? (!codeValide(code) ? 'Saisissez le code à 6 chiffres.' : null);
    if (message) { setErreur(message); return; }
    setEnvoi(true); setErreur(null);
    try { await ouvrir(await api.inscrireOtp({ ...payloadCandidature(form, false), code: code.trim() })); }
    catch (e) { setErreur((e as Error).message); }
    finally { setEnvoi(false); }
  }
  return <Page titre="Inscription par téléphone">
    <MessageErreur message={erreur} />
    <Champ libelle="Téléphone international" value={form.telephone} editable={!etape && !envoi}
      keyboardType="phone-pad" autoComplete="tel" onChangeText={telephone => setForm({ ...form, telephone })} />
    {!etape ? <Bouton titre="Recevoir le code" onPress={() => void envoyer()} chargement={envoi} desactive={secondes > 0} /> : <>
      <Info>Code envoyé à {form.telephone}. Valable 10 minutes, 5 essais maximum.</Info>
      <Champ libelle="Code SMS à 6 chiffres" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="sms-otp" />
      <ChampsDossier form={form} setForm={setForm} champs={champsIdentite.filter(([k]) => k !== 'telephone')} bloque={envoi} />
      <Bouton titre="Confirmer et créer mon compte" onPress={() => void verifier()} chargement={envoi} />
      <Bouton titre={secondes ? 'Renvoyer dans ' + secondes + ' s' : 'Renvoyer le code'} variante="secondaire"
        onPress={() => void envoyer()} desactive={secondes > 0 || envoi} />
      <Bouton titre="Changer de numéro" variante="discret" desactive={envoi} onPress={() => { setEtape(false); setCode(''); setErreur(null); }} />
    </>}
  </Page>;
}
export function MotDePasseOublie({ retour }: { retour: () => void }) {
  const [identifiant, setIdentifiant] = useState('');
  const [code, setCode] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [etape, setEtape] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const { secondes, demarrer } = useCompteARebours();
  async function demander() {
    if (!identifiant.trim()) { setErreur('Saisissez votre email ou téléphone.'); return; }
    setEnvoi(true); setErreur(null);
    try { await api.oubli(identifiant.trim()); setEtape(1); demarrer(); }
    catch (e) { setErreur((e as Error).message); }
    finally { setEnvoi(false); }
  }
  async function confirmer() {
    if (!codeValide(code) || !motDePasseValide(motDePasse) || motDePasse !== confirmation) {
      setErreur('Code à 6 chiffres requis, mot de passe de 8 caractères minimum et confirmation identique.'); return;
    }
    setEnvoi(true); setErreur(null);
    try { await api.reinitialiser(identifiant.trim(), code.trim(), motDePasse); setMotDePasse(''); setConfirmation(''); setEtape(2); }
    catch (e) { setErreur((e as Error).message); }
    finally { setEnvoi(false); }
  }
  return <Page titre="Mot de passe oublié">
    <MessageErreur message={erreur} />
    {etape === 2 ? <><Info>Mot de passe réinitialisé. Connectez-vous avec le nouveau mot de passe.</Info><Bouton titre="Retour à la connexion" onPress={retour} /></> : <>
      <Champ libelle="Email ou téléphone" value={identifiant} onChangeText={setIdentifiant} editable={etape === 0 && !envoi} autoCapitalize="none" />
      {etape === 0 ? <Bouton titre="Demander un code" onPress={() => void demander()} chargement={envoi} /> : <>
        <Info>Si ce compte existe, un code a été envoyé par email et, si renseigné, par SMS.</Info>
        <Champ libelle="Code à 6 chiffres" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
        <Champ libelle="Nouveau mot de passe (8 caractères minimum)" value={motDePasse} onChangeText={setMotDePasse} secureTextEntry autoComplete="new-password" />
        <Champ libelle="Confirmer le mot de passe" value={confirmation} onChangeText={setConfirmation} secureTextEntry />
        <Bouton titre="Réinitialiser" onPress={() => void confirmer()} chargement={envoi} />
        <Bouton titre={secondes ? 'Renvoyer dans ' + secondes + ' s' : 'Renvoyer le code'} variante="secondaire"
          desactive={secondes > 0 || envoi} onPress={() => void demander()} />
        <Bouton titre="Changer l’identifiant" variante="discret" desactive={envoi} onPress={() => setEtape(0)} />
      </>}
    </>}
  </Page>;
}
export function Candidature({ partenaire }: { partenaire: boolean }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ ...candidatureVide });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [soumis, setSoumis] = useState(false);
  async function envoyer() {
    const message = verifierCandidature(form, partenaire);
    if (message) { setErreur(message); return; }
    setEnvoi(true); setErreur(null);
    try {
      await api.candidater(partenaire, payloadCandidature(form, partenaire));
      setSoumis(true);
      await login(form.email, form.motDePasse);
      setForm({ ...candidatureVide });
    } catch (e) { setErreur((e as Error).message); }
    finally { setEnvoi(false); }
  }
  return <Page titre={partenaire ? 'Devenir partenaire' : 'Devenir coursier'}>
    <MessageErreur message={erreur} />
    {soumis ? <Info>Dossier enregistré. Connectez-vous pour suivre son statut.</Info> : <>
      <Info>Votre dossier sera examiné par un responsable avant l’activation de votre compte.</Info>
      <ChampsDossier form={form} setForm={setForm} champs={[...champsIdentite, ...(partenaire ? champsPartenaire : champsLivreur)]} bloque={envoi} />
      <Bouton titre="Soumettre ma candidature" onPress={() => void envoyer()} chargement={envoi} />
    </>}
  </Page>;
}
export function SuiviDossier() {
  const { profil, rafraichir, logout } = useAuth();
  const [dossier, setDossier] = useState<Compte | null>(null);
  const [form, setForm] = useState({ ...candidatureVide });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [succes, setSucces] = useState('');
  const [charge, setCharge] = useState(false);
  const appliquerDossier = useCallback(async (d: Compte) => {
    setDossier(d);
    setForm(Object.fromEntries(Object.keys(candidatureVide).map(k => [k, String(d[k as keyof Compte] ?? '')])) as FormCandidature);
    await rafraichir();
  }, [rafraichir]);
  const charger = useCallback(async () => {
    setEnvoi(true); setErreur(null);
    try {
      await appliquerDossier(await api.dossier());
    } catch (e) { setErreur((e as Error).message); }
    finally { setEnvoi(false); setCharge(true); }
  }, [appliquerDossier]);
  useEffect(() => {
    void api.dossier().then(appliquerDossier).catch(e => setErreur((e as Error).message)).finally(() => setCharge(true));
  }, [appliquerDossier]);
  async function corriger() {
    const message = verifierCandidature(form, dossier?.role === 'PARTENAIRE', true);
    if (message) { setErreur(message); return; }
    setEnvoi(true); setErreur(null);
    try {
      setDossier(await api.corrigerDossier(payloadCandidature(form, dossier?.role === 'PARTENAIRE', true)));
      setSucces('Complément envoyé. Votre dossier est de nouveau en attente.'); await rafraichir();
    } catch (e) { setErreur((e as Error).message); }
    finally { setEnvoi(false); }
  }
  return <Page titre="Suivi de mon dossier">
    <MessageErreur message={erreur} />
    {!charge && <Info>Chargement du dossier…</Info>}
    {charge && !dossier && !erreur && <Info>Aucun dossier disponible.</Info>}
    {dossier && <>
      <Info>{STATUTS_COMPTE[dossier.statut]} — {dossier.prenom} {dossier.nom}</Info>
      {dossier.motifStatut && <Info>Message du responsable : {dossier.motifStatut}</Info>}
      {dossier.statut === 'ACTIF' && <Info>Votre compte est validé. {profil?.role === 'PARTENAIRE' ? 'Les fonctions commerciales seront disponibles dans un prochain sprint.' : 'Votre espace est accessible.'}</Info>}
      {dossier.statut === 'EN_ATTENTE' && <Info>Votre candidature est en cours d’examen. Les fonctions de votre rôle seront disponibles après validation.</Info>}
      {dossier.statut === 'REFUSE' && <Info>Votre dossier a été refusé. Contactez le responsable pour toute question.</Info>}
      {dossier.statut === 'COMPLEMENT_DEMANDE' && <>
        <ChampsDossier form={form} setForm={setForm} champs={[...champsIdentite.filter(([k]) => k !== 'email' && k !== 'motDePasse'),
          ...(dossier.role === 'PARTENAIRE' ? champsPartenaire : champsLivreur)]} bloque={envoi} />
        <Bouton titre="Envoyer le complément" onPress={() => void corriger()} chargement={envoi} />
      </>}
    </>}
    {succes && <Info>{succes}</Info>}
    <Bouton titre="Actualiser le statut" onPress={() => void charger()} chargement={envoi} />
    <Bouton titre="Se déconnecter" variante="discret" onPress={() => void logout()} desactive={envoi} />
  </Page>;
}
