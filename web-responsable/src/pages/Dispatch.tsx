import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { Alerte, Badge, Champ, EnTete, EtatTableau, Modale, useDonnees } from '../composants/ui';
import { formatDate, formatDistance, STATUTS } from '../format';
import type { CommandeAttente, Livreur, LotSupervision, StatutOffre } from '../types';

const ACTUALISATION_MS = 10_000;
const MOTIF_MIN = 5;
const OFFRES: Record<StatutOffre, { libelle: string; couleur: string; fond: string }> = {
  EN_ATTENTE: { libelle: 'En attente', couleur: '#B45309', fond: '#FEF3C7' },
  ACCEPTEE: { libelle: 'Acceptée', couleur: '#15803D', fond: '#DCFCE7' },
  REFUSEE: { libelle: 'Refusée', couleur: '#B91C1C', fond: '#FEE2E2' },
  EXPIREE: { libelle: 'Expirée', couleur: '#4B5563', fond: '#F3F4F6' },
  ANNULEE: { libelle: 'Retirée', couleur: '#4B5563', fond: '#F3F4F6' },
};

/** Secondes restantes avant l'expiration d'une offre (jamais negatif). */
function secondesRestantes(expireLe: string, maintenant: number) {
  return Math.max(0, Math.round((new Date(expireLe).getTime() - maintenant) / 1000));
}

// US-407 : supervision du dispatch par lots en temps reel et affectation forcee
export default function Dispatch() {
  const { donnees, erreur, chargement, recharger } = useDonnees(api.supervision);
  const [forcer, setForcer] = useState<CommandeAttente | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cycle, setCycle] = useState(false);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  // Actualisation periodique : offres qui expirent, nouvelles commandes pretes, livreurs qui se connectent
  useEffect(() => {
    const minuterie = window.setInterval(() => { void recharger(); }, ACTUALISATION_MS);
    const horloge = window.setInterval(() => setMaintenant(Date.now()), 1000);
    return () => { window.clearInterval(minuterie); window.clearInterval(horloge); };
  }, [recharger]);

  async function lancerCycle() {
    setCycle(true);
    try {
      const r = await api.cycleDispatch();
      setMessage(`${r.offresExpirees} offre(s) expirée(s), ${r.offresProposees} offre(s) proposée(s).`);
      await recharger();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Cycle impossible.');
    } finally {
      setCycle(false);
    }
  }

  const alertes = donnees?.enAttente.filter((c) => c.alerte).length ?? 0;

  return (
    <>
      <EnTete titre="Dispatch" sousTitre={donnees
        ? `${donnees.parLots ? 'Lots de 2 à 3 collectes' : 'Affectation simple'} · ${donnees.ia ? 'service d’IA actif' : 'règles (sans IA)'} · offres de ${donnees.delaiOffreSecondes} s`
        : 'Supervision des commandes prêtes, des lots et des livreurs'}>
        <button className="bouton secondaire" onClick={() => void lancerCycle()} disabled={cycle}>Relancer le dispatch</button>
        <button className="bouton secondaire" onClick={() => void recharger()} disabled={chargement}>Actualiser</button>
      </EnTete>
      {message && <Alerte message={message} onFermer={() => setMessage(null)} />}
      {alertes > 0 && <Alerte message={`${alertes} commande(s) attendent un livreur depuis plus de ${donnees?.delaiRechercheMaxMinutes} min : forcez une assignation.`} />}

      <h2 className="section">Commandes prêtes sans livreur</h2>
      <div className="carte">
        <EtatTableau chargement={chargement && !donnees} erreur={erreur} vide={!donnees?.enAttente.length}
          messageVide="Aucune commande en attente de livreur." onReessayer={() => void recharger()} />
        {!!donnees?.enAttente.length && (
          <table>
            <thead><tr><th>Code</th><th>Commerce</th><th>Zone</th><th className="nombre">Attente</th><th>Offre en cours</th><th /></tr></thead>
            <tbody>
              {donnees.enAttente.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.codeSuivi}</td>
                  <td>{c.nomCommerce ?? '—'}</td>
                  <td>{c.zoneNom ?? '—'}</td>
                  <td className="nombre">
                    {c.alerte ? <Badge texte={`${c.minutesAttente} min`} couleur="#B91C1C" fond="#FEE2E2" /> : `${c.minutesAttente} min`}
                  </td>
                  <td>{c.offre
                    ? `${c.offre.livreurPrenom}${c.offre.horsZone ? ' (hors zone)' : ''} · ${secondesRestantes(c.offre.expireLe, maintenant)} s`
                    : <span className="discret">{c.lotId ? `Lot n°${c.lotId} sans livreur` : 'Aucun livreur disponible'}</span>}</td>
                  <td><button className="bouton-lien" onClick={() => setForcer(c)}>Forcer une assignation</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="section">Lots</h2>
      <div className="carte">
        {donnees && !donnees.lots.length && <div className="etat"><p>Aucun lot en cours.</p></div>}
        {!!donnees?.lots.length && (
          <table>
            <thead><tr><th>Lot</th><th>Commandes</th><th>Livreur</th><th className="nombre">Trajet</th><th>Offres</th></tr></thead>
            <tbody>{donnees.lots.map((l) => <LigneLot key={l.id} lot={l} />)}</tbody>
          </table>
        )}
      </div>

      <h2 className="section">Livreurs disponibles</h2>
      <div className="carte">
        {donnees && !donnees.livreurs.length && <div className="etat"><p>Aucun livreur disponible en ce moment.</p></div>}
        {!!donnees?.livreurs.length && (
          <table>
            <thead><tr><th>Livreur</th><th className="nombre">Missions</th><th>Offre</th><th>Dernière position</th></tr></thead>
            <tbody>
              {donnees.livreurs.map((l) => (
                <tr key={l.id}>
                  <td>{l.prenom} {l.nom}</td>
                  <td className="nombre">{l.missions} / 3</td>
                  <td>{l.offreEnCours ? <Badge texte="Offre en attente" {...OFFRES.EN_ATTENTE} /> : <span className="discret">—</span>}</td>
                  <td className="discret">{l.dernierePositionLe ? formatDate(l.dernierePositionLe) : 'Inconnue'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {forcer && <FormulaireForcer commande={forcer} onFermer={() => setForcer(null)}
        onFait={(texte) => { setForcer(null); setMessage(texte); void recharger(); }} />}
    </>
  );
}

function LigneLot({ lot }: { lot: LotSupervision }) {
  return (
    <tr>
      <td>
        <strong>n°{lot.id}</strong> <Badge texte={lot.statut === 'ACCEPTE' ? 'Accepté' : 'Proposé'}
          couleur={lot.statut === 'ACCEPTE' ? '#15803D' : '#B45309'} fond={lot.statut === 'ACCEPTE' ? '#DCFCE7' : '#FEF3C7'} />
        <div className="discret">{lot.source === 'FORCE' ? 'Affectation forcée' : lot.source === 'IA' ? 'Formé par l’IA' : 'Formé par règles'}</div>
      </td>
      <td>{lot.commandes.map((c) => (
        <div key={c.id}><span className="mono">{c.codeSuivi}</span> <Badge texte={STATUTS[c.statut].libelle} {...STATUTS[c.statut]} /></div>
      ))}</td>
      <td>{lot.livreurPrenom ?? <span className="discret">—</span>}</td>
      <td className="nombre sans-retour">{formatDistance(lot.distanceKm)} · {lot.dureeMinutes} min</td>
      <td>{lot.offres.length ? lot.offres.map((o) => (
        <div key={o.id} title={o.motifRefus ?? undefined}>
          {o.livreurPrenom}{o.horsZone ? ' (hors zone)' : ''} <Badge texte={OFFRES[o.statut].libelle} {...OFFRES[o.statut]} />
        </div>
      )) : <span className="discret">—</span>}</td>
    </tr>
  );
}

function FormulaireForcer({ commande, onFermer, onFait }: {
  commande: CommandeAttente;
  onFermer: () => void;
  onFait: (message: string) => void;
}) {
  const [livreurs, setLivreurs] = useState<Livreur[] | null>(null);
  const [livreurId, setLivreurId] = useState('');
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    try {
      setLivreurs((await api.livreurs()).filter((l) => l.actif));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Livreurs indisponibles.');
    }
  }, []);
  useEffect(() => { void charger(); }, [charger]);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (!livreurId) { setErreur('Choisissez le livreur.'); return; }
    if (motif.trim().length < MOTIF_MIN) { setErreur(`Indiquez le motif (${MOTIF_MIN} caractères minimum).`); return; }
    setEnvoi(true);
    setErreur(null);
    try {
      await api.forcerAffectation(commande.id, Number(livreurId), motif.trim());
      const choisi = livreurs?.find((l) => String(l.id) === livreurId);
      onFait(`${commande.codeSuivi} affectée à ${choisi ? choisi.prenom + ' ' + choisi.nom : 'ce livreur'}.`);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Affectation impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Modale titre={`Forcer l’assignation de ${commande.codeSuivi}`} onFermer={onFermer}>
      <form className="formulaire" onSubmit={(e) => void envoyer(e)}>
        <p className="discret">L’offre en cours est retirée. Le livreur reçoit la mission sans avoir à l’accepter ; l’action est inscrite au journal d’audit.</p>
        {erreur && <Alerte message={erreur} />}
        <Champ libelle="Livreur">
          <select value={livreurId} onChange={(e) => setLivreurId(e.target.value)} disabled={!livreurs}>
            <option value="">{livreurs ? 'Choisir un livreur' : 'Chargement…'}</option>
            {livreurs?.map((l) => <option key={l.id} value={l.id}>{l.prenom} {l.nom}{l.zonePrincipale ? ` · ${l.zonePrincipale}` : ''}</option>)}
          </select>
        </Champ>
        <Champ libelle="Motif" aide="Visible dans l’historique de la commande et dans l’audit.">
          <textarea value={motif} maxLength={300} rows={3} onChange={(e) => setMotif(e.target.value)} />
        </Champ>
        <div className="actions">
          <button type="button" className="bouton secondaire" onClick={onFermer}>Annuler</button>
          <button className="bouton plein" disabled={envoi}>Affecter</button>
        </div>
      </form>
    </Modale>
  );
}
