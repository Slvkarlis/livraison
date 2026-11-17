import { useCallback, useState, type FormEvent } from 'react';
import { api } from '../api';
import { Alerte, Badge, Champ, EnTete, EtatTableau, Modale, useDonnees } from '../composants/ui';
import { formatDate, formatMontant } from '../format';
import type { Bareme, Closing, PorteeCommission, SoldeCoursier } from '../types';

type Onglet = 'caisses' | 'closing' | 'parametres' | 'ledger';
const ONGLETS: { id: Onglet; libelle: string }[] = [
  { id: 'caisses', libelle: 'Cash des livreurs' },
  { id: 'closing', libelle: 'Closing hebdomadaire' },
  { id: 'parametres', libelle: 'Commissions et barèmes' },
  { id: 'ledger', libelle: 'Ledger' },
];
const MOTIF_MIN = 5;

/** Montant saisi (« 14,5 » accepte) : null si illisible ou plus de 3 decimales. */
function lireMontant(saisie: string): number | null {
  const texte = saisie.trim().replace(',', '.');
  return /^\d+(\.\d{1,3})?$/.test(texte) ? Number(texte) : null;
}

/** Lundi de la semaine derniere, au format AAAA-MM-JJ (semaine a clore par defaut). */
function lundiPrecedent(): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Sprint 5 : chaine financiere du responsable FINANCE (US-501 a US-506, US-512)
export default function Finance() {
  const [onglet, setOnglet] = useState<Onglet>('caisses');
  return (
    <>
      <EnTete titre="Finance" sousTitre="Commissions, cash en circulation, dépôts, reversements et rémunérations." />
      <div className="filtres">
        {ONGLETS.map((o) => (
          <button key={o.id} className={`puce ${onglet === o.id ? 'active' : ''}`} onClick={() => setOnglet(o.id)}>{o.libelle}</button>
        ))}
      </div>
      {onglet === 'caisses' && <Caisses />}
      {onglet === 'closing' && <ClosingHebdomadaire />}
      {onglet === 'parametres' && <Parametres />}
      {onglet === 'ledger' && <Ledger />}
    </>
  );
}

// US-505 : soldes des livreurs, depot integral avec recu
function Caisses() {
  const { donnees, erreur, chargement, recharger } = useDonnees(api.caisses);
  const recus = useDonnees(api.recus);
  const [depot, setDepot] = useState<SoldeCoursier | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      {message && <Alerte message={message} onFermer={() => setMessage(null)} />}
      <h2 className="section">Cash en circulation : {donnees ? formatMontant(donnees.cashEnCirculation) : '…'}</h2>
      <div className="carte">
        <EtatTableau chargement={chargement && !donnees} erreur={erreur} vide={!donnees?.coursiers.length}
          messageVide="Aucun livreur ne détient de cash." onReessayer={() => void recharger()} />
        {!!donnees?.coursiers.length && (
          <table>
            <thead><tr><th>Livreur</th><th className="nombre">Commandes</th><th>Plus ancienne</th><th className="nombre">Solde</th><th /></tr></thead>
            <tbody>
              {donnees.coursiers.map((c) => (
                <tr key={c.livreurId}>
                  <td>{c.prenom} {c.nom}</td>
                  <td className="nombre">{c.nbCommandes}</td>
                  <td className="discret">{c.plusAncienne ? formatDate(c.plusAncienne) : '—'}</td>
                  <td className="nombre"><strong>{formatMontant(c.solde)}</strong></td>
                  <td><button className="bouton-lien" onClick={() => setDepot(c)}>Enregistrer le dépôt</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="section">Derniers reçus</h2>
      <div className="carte">
        {recus.donnees && !recus.donnees.length && <div className="etat"><p>Aucun dépôt enregistré.</p></div>}
        {!!recus.donnees?.length && (
          <table>
            <thead><tr><th>Reçu</th><th>Livreur</th><th>Date</th><th className="nombre">Attendu</th><th className="nombre">Reçu</th><th>Statut</th></tr></thead>
            <tbody>
              {recus.donnees.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.numeroRecu}</td>
                  <td>{r.livreurNom}</td>
                  <td className="discret">{formatDate(r.date)}</td>
                  <td className="nombre">{formatMontant(r.montantAttendu)}</td>
                  <td className="nombre">{formatMontant(r.montantRecu)}</td>
                  <td title={r.motifEcart ?? undefined}>{r.statut === 'RAPPROCHE'
                    ? <Badge texte="Rapproché" couleur="#15803D" fond="#DCFCE7" />
                    : <Badge texte={`Écart ${formatMontant(r.ecart)}`} couleur="#B91C1C" fond="#FEE2E2" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {depot && <FormulaireDepot coursier={depot} onFermer={() => setDepot(null)} onFait={(texte) => {
        setDepot(null); setMessage(texte); void recharger(); void recus.recharger();
      }} />}
    </>
  );
}

function FormulaireDepot({ coursier, onFermer, onFait }: { coursier: SoldeCoursier; onFermer: () => void; onFait: (m: string) => void }) {
  const [montant, setMontant] = useState(coursier.solde.toFixed(3));
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  // Une cle par ouverture du formulaire : un double clic ou un reseau lent n'enregistre qu'un depot
  const [cle] = useState(() => `depot-${coursier.livreurId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const valeur = lireMontant(montant);
  const ecart = valeur === null ? null : Math.round((valeur - coursier.solde) * 1000) / 1000;

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (valeur === null) { setErreur('Montant invalide (3 décimales au plus).'); return; }
    if (ecart !== 0 && motif.trim().length < MOTIF_MIN) { setErreur('Le montant diffère du solde : indiquez le motif de l’écart.'); return; }
    setEnvoi(true);
    setErreur(null);
    try {
      const recu = await api.deposer(coursier.livreurId, valeur, ecart === 0 ? null : motif.trim(), cle);
      onFait(`Reçu ${recu.numeroRecu} : ${formatMontant(recu.montantRecu)} pour ${recu.nbCommandes} commande(s).`);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Dépôt impossible.');
      setEnvoi(false);
    }
  }

  return (
    <Modale titre={`Dépôt de ${coursier.prenom} ${coursier.nom}`} onFermer={onFermer}>
      <form className="formulaire" onSubmit={(e) => void envoyer(e)}>
        <p className="discret">Solde à déposer : <strong>{formatMontant(coursier.solde)}</strong> pour {coursier.nbCommandes} commande(s). Le dépôt est intégral : toutes ces commandes seront rapprochées.</p>
        {erreur && <Alerte message={erreur} />}
        <Champ libelle="Montant reçu (DT)"><input inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} /></Champ>
        {ecart !== null && ecart !== 0 && (
          <Champ libelle={`Motif de l’écart (${ecart > 0 ? '+' : ''}${ecart.toFixed(3)} DT)`}>
            <textarea value={motif} maxLength={300} rows={2} onChange={(e) => setMotif(e.target.value)} />
          </Champ>
        )}
        <div className="actions">
          <button type="button" className="bouton secondaire" onClick={onFermer}>Annuler</button>
          <button className="bouton plein" disabled={envoi}>Enregistrer et générer le reçu</button>
        </div>
      </form>
    </Modale>
  );
}

// US-506 / US-512 : apercu puis validation du closing d'une semaine terminee
function ClosingHebdomadaire() {
  const [semaine, setSemaine] = useState(lundiPrecedent);
  const charger = useCallback(() => api.apercuClosing(semaine), [semaine]);
  const apercu = useDonnees(charger);
  const historique = useDonnees(api.closings);
  const [message, setMessage] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function valider() {
    setEnvoi(true);
    try {
      const c = await api.validerClosing(semaine);
      setMessage(`Closing de la semaine du ${c.semaine} validé : ${formatMontant(c.totalReversements)} à reverser, ${formatMontant(c.totalRemunerations)} de rémunérations.`);
      await Promise.all([apercu.recharger(), historique.recharger()]);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Validation impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  const c = apercu.donnees;
  return (
    <>
      {message && <Alerte message={message} onFermer={() => setMessage(null)} />}
      <div className="filtres">
        <Champ libelle="Semaine (un jour de la semaine)"><input type="date" value={semaine} onChange={(e) => setSemaine(e.target.value)} /></Champ>
        {c && !c.id && <button className="bouton plein" disabled={envoi} onClick={() => void valider()}>Valider le closing</button>}
      </div>
      <EtatTableau chargement={apercu.chargement && !c} erreur={apercu.erreur} vide={false} messageVide="" onReessayer={() => void apercu.recharger()} />
      {c && <ResumeClosing closing={c} />}

      <h2 className="section">Closings validés</h2>
      <div className="carte">
        {historique.donnees && !historique.donnees.length && <div className="etat"><p>Aucun closing validé.</p></div>}
        {!!historique.donnees?.length && (
          <table>
            <thead><tr><th>Semaine du</th><th>Validé le</th><th>Par</th><th className="nombre">Reversements</th><th className="nombre">Rémunérations</th></tr></thead>
            <tbody>
              {historique.donnees.map((h) => (
                <tr key={h.id ?? h.semaine} className="cliquable" onClick={() => setSemaine(h.semaine)}>
                  <td>{h.semaine}</td>
                  <td className="discret">{h.valideLe ? formatDate(h.valideLe) : '—'}</td>
                  <td>{h.validePar}</td>
                  <td className="nombre">{formatMontant(h.totalReversements)}</td>
                  <td className="nombre">{formatMontant(h.totalRemunerations)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function ResumeClosing({ closing }: { closing: Closing }) {
  return (
    <>
      <h2 className="section">
        {closing.id ? `Closing validé le ${closing.valideLe ? formatDate(closing.valideLe) : ''}` : 'Aperçu (rien n’est encore enregistré)'}
        {' · '}du {formatDate(closing.debut)} au {formatDate(closing.fin)}
      </h2>
      {!closing.id && closing.commandesNonRapprochees > 0 && (
        <Alerte message={`${closing.commandesNonRapprochees} commande(s) livrée(s) attendent le dépôt de leur cash (${formatMontant(closing.cashNonRapproche)}) : elles seront reversées à un prochain closing.`} />
      )}
      <div className="carte">
        <table>
          <thead><tr><th>Partenaire</th><th className="nombre">Commandes</th><th className="nombre">Ventes</th><th className="nombre">Commission</th><th className="nombre">Net à reverser</th></tr></thead>
          <tbody>
            {closing.partenaires.map((p) => (
              <tr key={p.partenaireId}><td>{p.nomCommerce}</td><td className="nombre">{p.nbCommandes}</td><td className="nombre">{formatMontant(p.ventes)}</td>
                <td className="nombre">{formatMontant(p.commission)}</td><td className="nombre"><strong>{formatMontant(p.net)}</strong></td></tr>
            ))}
            {!closing.partenaires.length && <tr><td colSpan={5} className="discret">Aucun reversement.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="carte" style={{ marginTop: 12 }}>
        <table>
          <thead><tr><th>Livreur</th><th className="nombre">Missions</th><th className="nombre">Distance</th><th className="nombre">Rémunération</th></tr></thead>
          <tbody>
            {closing.coursiers.map((l) => (
              <tr key={l.livreurId}><td>{l.prenom} {l.nom}</td><td className="nombre">{l.nbMissions}</td>
                <td className="nombre">{l.distanceKm.toFixed(1).replace('.', ',')} km</td><td className="nombre"><strong>{formatMontant(l.remuneration)}</strong></td></tr>
            ))}
            {!closing.coursiers.length && <tr><td colSpan={4} className="discret">Aucune mission à payer.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// US-502 : taux de commission ; US-512 : bareme par zone
function Parametres() {
  const commissions = useDonnees(api.commissions);
  const baremes = useDonnees(api.baremes);
  const [portee, setPortee] = useState<PorteeCommission>('GLOBAL');
  const [cible, setCible] = useState('');
  const [taux, setTaux] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [bareme, setBareme] = useState<Bareme | null>(null);

  async function enregistrerTaux(e: FormEvent) {
    e.preventDefault();
    const valeur = Number(taux.replace(',', '.'));
    if (!taux.trim() || Number.isNaN(valeur)) { setMessage('Indiquez un taux en %.'); return; }
    try {
      await api.definirCommission(portee, portee === 'CATEGORIE' ? { categorie: cible } : portee === 'PARTENAIRE' ? { partenaireId: Number(cible) } : {}, valeur);
      setMessage('Taux enregistré : il s’applique aux prochaines livraisons.');
      setTaux(''); setCible('');
      await commissions.recharger();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  }

  async function supprimer(id: number) {
    try { await api.supprimerCommission(id); await commissions.recharger(); } catch (err) { setMessage(err instanceof Error ? err.message : 'Suppression impossible.'); }
  }

  return (
    <>
      {message && <Alerte message={message} onFermer={() => setMessage(null)} />}
      <h2 className="section">Commissions (taux global : {commissions.donnees ? `${commissions.donnees.tauxGlobal} %` : '…'})</h2>
      <form className="filtres" onSubmit={(e) => void enregistrerTaux(e)}>
        <Champ libelle="Portée"><select value={portee} onChange={(e) => setPortee(e.target.value as PorteeCommission)}>
          <option value="GLOBAL">Global</option><option value="CATEGORIE">Catégorie</option><option value="PARTENAIRE">Partenaire</option>
        </select></Champ>
        {portee !== 'GLOBAL' && <Champ libelle={portee === 'CATEGORIE' ? 'Catégorie' : 'N° du partenaire'}>
          <input value={cible} onChange={(e) => setCible(e.target.value)} inputMode={portee === 'PARTENAIRE' ? 'numeric' : 'text'} />
        </Champ>}
        <Champ libelle="Taux (%)"><input inputMode="decimal" value={taux} onChange={(e) => setTaux(e.target.value)} /></Champ>
        <button className="bouton plein">Enregistrer</button>
      </form>
      <div className="carte">
        {!!commissions.donnees?.taux.length && (
          <table>
            <thead><tr><th>Portée</th><th>Cible</th><th className="nombre">Taux</th><th>Modifié</th><th /></tr></thead>
            <tbody>
              {commissions.donnees.taux.map((t) => (
                <tr key={t.id}>
                  <td>{t.portee === 'GLOBAL' ? 'Global' : t.portee === 'CATEGORIE' ? 'Catégorie' : 'Partenaire'}</td>
                  <td>{t.categorie ?? t.nomCommerce ?? '—'}</td>
                  <td className="nombre">{t.taux} %</td>
                  <td className="discret">{t.modifieLe ? `${formatDate(t.modifieLe)} · ${t.modifiePar ?? ''}` : '—'}</td>
                  <td><button className="bouton-lien" onClick={() => void supprimer(t.id)}>Supprimer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {commissions.donnees && !commissions.donnees.taux.length && <div className="etat"><p>Aucun taux configuré : 12 % s’applique.</p></div>}
      </div>

      <h2 className="section">Rémunération des livreurs par zone</h2>
      <div className="carte">
        <EtatTableau chargement={baremes.chargement && !baremes.donnees} erreur={baremes.erreur} vide={!baremes.donnees?.length}
          messageVide="Aucune zone." onReessayer={() => void baremes.recharger()} />
        {!!baremes.donnees?.length && (
          <table>
            <thead><tr><th>Zone</th><th className="nombre">Base / mission</th><th className="nombre">Par km</th><th /></tr></thead>
            <tbody>
              {baremes.donnees.map((b) => (
                <tr key={b.zoneId}>
                  <td>{b.zoneNom} {b.parDefaut && <span className="discret">(défaut)</span>}</td>
                  <td className="nombre">{formatMontant(b.base)}</td>
                  <td className="nombre">{formatMontant(b.parKm)}</td>
                  <td><button className="bouton-lien" onClick={() => setBareme(b)}>Modifier</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {bareme && <FormulaireBareme bareme={bareme} onFermer={() => setBareme(null)} onFait={() => { setBareme(null); void baremes.recharger(); }} />}
    </>
  );
}

function FormulaireBareme({ bareme, onFermer, onFait }: { bareme: Bareme; onFermer: () => void; onFait: () => void }) {
  const [base, setBase] = useState(bareme.base.toFixed(3));
  const [parKm, setParKm] = useState(bareme.parKm.toFixed(3));
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    const b = lireMontant(base), k = lireMontant(parKm);
    if (b === null || k === null) { setErreur('Montants positifs, 3 décimales au plus.'); return; }
    try { await api.definirBareme(bareme.zoneId, b, k); onFait(); } catch (err) { setErreur(err instanceof Error ? err.message : 'Enregistrement impossible.'); }
  }

  return (
    <Modale titre={`Barème · ${bareme.zoneNom}`} onFermer={onFermer}>
      <form className="formulaire" onSubmit={(e) => void envoyer(e)}>
        <p className="discret">Rémunération d’une mission = base + prix par km × distance commerce → client. S’applique aux livraisons suivantes.</p>
        {erreur && <Alerte message={erreur} />}
        <Champ libelle="Base par mission (DT)"><input inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} /></Champ>
        <Champ libelle="Prix par km (DT)"><input inputMode="decimal" value={parKm} onChange={(e) => setParKm(e.target.value)} /></Champ>
        <div className="actions">
          <button type="button" className="bouton secondaire" onClick={onFermer}>Annuler</button>
          <button className="bouton plein">Enregistrer</button>
        </div>
      </form>
    </Modale>
  );
}

// US-503 : lecture du ledger immuable
function Ledger() {
  const [commandeId, setCommandeId] = useState('');
  const [query, setQuery] = useState('limite=200');
  const charger = useCallback(() => api.ledger(query), [query]);
  const { donnees, erreur, chargement, recharger } = useDonnees(charger);

  function filtrer(e: FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({ limite: '200' });
    if (commandeId.trim()) q.set('commandeId', commandeId.trim());
    setQuery(q.toString());
  }

  return (
    <>
      <form className="filtres" onSubmit={filtrer}>
        <Champ libelle="N° de commande"><input inputMode="numeric" value={commandeId} onChange={(e) => setCommandeId(e.target.value)} /></Champ>
        <button className="bouton plein">Filtrer</button>
      </form>
      <div className="carte">
        <EtatTableau chargement={chargement && !donnees} erreur={erreur} vide={!donnees?.length} messageVide="Aucune écriture."
          onReessayer={() => void recharger()} />
        {!!donnees?.length && (
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Libellé</th><th className="nombre">Montant</th></tr></thead>
            <tbody>
              {donnees.map((e) => (
                <tr key={e.id}>
                  <td className="discret sans-retour">{formatDate(e.date)}</td>
                  <td className="mono">{e.type}</td>
                  <td>{e.libelle}</td>
                  <td className="nombre">{formatMontant(e.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
