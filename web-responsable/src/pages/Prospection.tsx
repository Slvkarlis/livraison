import { useState } from 'react';
import { Chiffre, StatHero, StatTuile } from '../composants/luxe';
import { api, type ProspectVue } from '../api';
import { Alerte, EnTete, EtatTableau, useDonnees } from '../composants/ui';

const SOURCES = [
  { valeur: 'REGISTRE_COMMERCE', libelle: 'Registre du commerce' },
  { valeur: 'PARTENAIRE_RECOMMANDE', libelle: 'Recommandé par un partenaire' },
  { valeur: 'SAISIE_TERRAIN', libelle: 'Saisie sur le terrain' },
  { valeur: 'IMPORT_AUTORISE', libelle: 'Import autorisé' },
];
const STATUTS = ['A_CONTACTER', 'CONTACTE', 'INTERESSE', 'INSCRIT', 'REFUSE'];

/** Saisie d'une ligne : nom;categorie;adresse;latitude;longitude */
function lignesDepuisTexte(texte: string) {
  return texte.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [nom = '', categorie = '', adresse = '', lat = '', lng = ''] = l.split(';').map(v => v.trim());
    const latitude = lat === '' ? null : Number(lat.replace(',', '.'));
    const longitude = lng === '' ? null : Number(lng.replace(',', '.'));
    return { nom, categorie, adresse, latitude, longitude };
  });
}

export default function Prospection() {
  const { donnees, erreur, chargement, recharger } = useDonnees(api.prospects);
  const [source, setSource] = useState('SAISIE_TERRAIN');
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const [succes, setSucces] = useState('');
  const [avertissements, setAvertissements] = useState<string[]>([]);

  async function importer() {
    setEnvoi(true); setEchec(null); setSucces(''); setAvertissements([]);
    try {
      const lignes = lignesDepuisTexte(texte);
      if (!lignes.length) throw new Error('Saisissez au moins une ligne.');
      const r = await api.importerProspects(source, lignes);
      setSucces(`${r.crees} prospect${r.crees > 1 ? 's' : ''} importé${r.crees > 1 ? 's' : ''}.`);
      setAvertissements(r.erreurs);
      if (r.crees > 0) setTexte('');
      await recharger();
    } catch (e) { setEchec((e as Error).message); } finally { setEnvoi(false); }
  }

  async function scorer() {
    setEchec(null); setSucces('');
    try { const n = await api.scorerProspects(); setSucces(`Score recalculé pour ${n} prospect${n > 1 ? 's' : ''}.`); await recharger(); }
    catch (e) { setEchec((e as Error).message); }
  }

  async function changer(p: ProspectVue, statut: string) {
    let commentaire = '';
    if (statut === 'REFUSE') {
      commentaire = window.prompt('Motif du refus (obligatoire) :') ?? '';
      if (!commentaire.trim()) return;
    }
    setEchec(null);
    try { await api.statutProspect(p.id, statut, commentaire); await recharger(); }
    catch (e) { setEchec((e as Error).message); }
  }

  return (
    <>
      <EnTete titre="Prospection" sousTitre="Importez des commerces depuis une source déclarée, puis classez-les par potentiel.">
        <button className="bouton secondaire" onClick={() => void scorer()}>Recalculer les scores</button>
      </EnTete>
      {echec && <Alerte message={echec} />}
      {succes && <p role="status" className="bandeau">{succes}</p>}
      {donnees && <div className="bande-vedette">
        <StatHero legende="À contacter" valeur={<Chiffre valeur={donnees.filter(p => p.statut === 'A_CONTACTER').length} />} pastille="Pipeline"
          note={<><b>{donnees.length}</b> commerce{donnees.length > 1 ? 's' : ''} importé{donnees.length > 1 ? 's' : ''}</>} />
        <StatTuile legende="Intéressés" valeur={<Chiffre valeur={donnees.filter(p => p.statut === 'INTERESSE').length} />} note={`${donnees.filter(p => p.statut === 'INSCRIT').length} déjà inscrits`} ton="succes" delta="Conversion" />
        <StatTuile legende="Score moyen" valeur={donnees.some(p => p.score != null) ? Math.round(donnees.reduce((n, p) => n + (p.score ?? 0), 0) / Math.max(1, donnees.filter(p => p.score != null).length) * 100) / 100 : '—'} note="potentiel estimé par le modèle" ton="accent" delta="Potentiel" />
      </div>}
      <div className="carte">
        <h2>Importer des prospects</h2>
        <form className="formulaire" onSubmit={e => { e.preventDefault(); void importer(); }}>
          <label className="champ">Source
            <select value={source} disabled={envoi} onChange={e => setSource(e.target.value)}>
              {SOURCES.map(s => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}
            </select>
          </label>
          <label className="champ">Une ligne par commerce : nom;catégorie;adresse;latitude;longitude
            <textarea rows={5} value={texte} disabled={envoi} placeholder={'Epicerie Lina;epicerie;Rue de Marseille;36.80;10.18'} onChange={e => setTexte(e.target.value)} />
          </label>
          {avertissements.length > 0 && <ul className="discret">{avertissements.map((a, i) => <li key={i}>{a}</li>)}</ul>}
          <div className="pied-modale"><button className="bouton" disabled={envoi}>{envoi ? 'Import…' : 'Importer'}</button></div>
        </form>
      </div>
      <div className="carte">
        <h2>Prospects classés par score</h2>
        <EtatTableau chargement={chargement} erreur={erreur} vide={!donnees?.length} messageVide="Aucun prospect importé." onReessayer={() => void recharger()} />
        {!!donnees?.length && <table>
          <thead><tr><th>Nom</th><th>Catégorie</th><th>Zone</th><th>Score</th><th>Statut</th></tr></thead>
          <tbody>{[...donnees].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map(p => <tr key={p.id}>
            <td>{p.nom}</td><td>{p.categorie}</td><td>{p.zone ?? '—'}</td>
            <td>{p.score == null ? '—' : Math.round(p.score) + ' / 100'}</td>
            <td><select aria-label={`Statut de ${p.nom}`} value={p.statut} onChange={e => void changer(p, e.target.value)}>
              {STATUTS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select></td>
          </tr>)}</tbody>
        </table>}
      </div>
    </>
  );
}
