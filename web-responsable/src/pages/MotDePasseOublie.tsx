import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Alerte, Champ } from '../composants/ui';
import { codeValide, motDePasseValide } from '../sprint1';
export default function MotDePasseOublie() {
  const [identifiant, setIdentifiant] = useState('');
  const [code, setCode] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [etape, setEtape] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fin, setFin] = useState(0);
  const [secondes, setSecondes] = useState(0);
  useEffect(() => { const id = setInterval(() => setSecondes(Math.max(0, Math.ceil((fin - Date.now()) / 1000))), 500); return () => clearInterval(id); }, [fin]);
  async function demander() {
    setEnvoi(true); setErreur(null);
    try {
      const config = await api.demo();
      await api.oubli(identifiant.trim());
      setSecondes(config.delaiRenvoiSecondes); setFin(Date.now() + config.delaiRenvoiSecondes * 1000); setEtape(1);
    }
    catch (e) { setErreur((e as Error).message); }
    finally { setEnvoi(false); }
  }
  async function soumettre(e: FormEvent) {
    e.preventDefault(); if (envoi) return;
    if (etape === 0) { await demander(); return; }
    if (!codeValide(code) || !motDePasseValide(motDePasse) || confirmation !== motDePasse) {
      setErreur('Code à 6 chiffres, mot de passe de 8 caractères minimum et confirmation identique requis.'); return;
    }
    setEnvoi(true); setErreur(null);
    try { await api.reinitialiser(identifiant.trim(), code.trim(), motDePasse); setEtape(2); setMotDePasse(''); setConfirmation(''); }
    catch (err) { setErreur((err as Error).message); }
    finally { setEnvoi(false); }
  }
  return <div className="page-connexion"><form className="carte-connexion" onSubmit={soumettre}>
    <h1>Mot de passe oublié</h1>
    {erreur && <Alerte message={erreur} />}
    {etape === 2 ? <p role="status" className="succes">Mot de passe réinitialisé. Vous pouvez vous reconnecter.</p> : <>
      <Champ libelle="Email ou téléphone"><input required autoComplete="username" value={identifiant} readOnly={etape === 1} disabled={envoi} onChange={e => setIdentifiant(e.target.value)} /></Champ>
      {etape === 1 && <>
        <p role="status">Si le compte existe, un code a été envoyé par email et, si renseigné, par SMS.</p>
        <Champ libelle="Code à 6 chiffres"><input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} /></Champ>
        <Champ libelle="Nouveau mot de passe (8 caractères minimum)"><input type="password" required minLength={8} autoComplete="new-password" value={motDePasse} onChange={e => setMotDePasse(e.target.value)} /></Champ>
        <Champ libelle="Confirmer le mot de passe"><input type="password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></Champ>
      </>}
      <button className="bouton plein" disabled={envoi}>{envoi ? 'Envoi…' : etape ? 'Réinitialiser' : 'Recevoir un code'}</button>
      {etape === 1 && <div className="actions">
        <button className="bouton secondaire" type="button" disabled={envoi || secondes > 0} onClick={() => void demander()}>{secondes ? 'Renvoyer dans ' + secondes + ' s' : 'Renvoyer le code'}</button>
        <button className="bouton-lien" type="button" disabled={envoi} onClick={() => setEtape(0)}>Changer l’identifiant</button>
      </div>}
    </>}
    <p><Link to="/connexion">Retour à la connexion</Link></p>
  </form></div>;
}
