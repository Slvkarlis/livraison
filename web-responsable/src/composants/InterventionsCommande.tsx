import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../api';
import { formatDate, formatMontant, STATUTS } from '../format';
import type { ActionResponsable, SuiviResponsable } from '../types';
import { Alerte, Champ } from './ui';

const LIBELLES_ACTIONS: Record<ActionResponsable, string> = {
  VALIDER_COLLECTE: 'Valider la collecte',
  VALIDER_REMISE: 'Valider la remise',
  ANNULER: 'Annuler la commande',
};
const AIDES_ACTIONS: Record<ActionResponsable, string> = {
  VALIDER_COLLECTE: 'Le livreur a le colis mais ne peut pas scanner l’étiquette. Le client recevra son code de remise.',
  VALIDER_REMISE: 'Le client a reçu son colis mais ne peut montrer ni QR ni code. Indiquez le montant réellement encaissé.',
  ANNULER: 'Le client est notifié avec le motif. Aucun montant ne lui sera demandé.',
};
const MODES_REMISE = { QR: 'QR du client', CODE: 'Code SMS', MANUELLE: 'Validation manuelle' } as const;
const ROLES: Record<string, string> = { CLIENT: 'Client', PARTENAIRE: 'Partenaire', LIVREUR: 'Livreur', RESPONSABLE: 'Responsable' };
const MOTIF_MIN = 5;

/** Montant saisi (« 14,5 » accepte) : null si illisible ou plus de 3 decimales. */
function lireMontant(saisie: string): number | null {
  const texte = saisie.trim().replace(',', '.');
  return /^\d+(\.\d{1,3})?$/.test(texte) ? Number(texte) : null;
}

// US-311 : historique de la commande et interventions du responsable (motif obligatoire, tracees dans l'audit)
export function InterventionsCommande({ commandeId, onModifiee }: { commandeId: number; onModifiee: () => void }) {
  const [suivi, setSuivi] = useState<SuiviResponsable | null>(null);
  const [interdit, setInterdit] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [action, setAction] = useState<ActionResponsable | null>(null);

  const charger = useCallback(async () => {
    try {
      setSuivi(await api.suiviCommande(commandeId));
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setInterdit(true);   // sous-role sans acces aux operations
      else setErreur(e instanceof Error ? e.message : 'Suivi indisponible.');
    }
  }, [commandeId]);
  useEffect(() => { void charger(); }, [charger]);

  if (interdit) return null;
  if (!suivi) return erreur ? <Alerte message={erreur} /> : <p className="discret">Chargement du suivi…</p>;

  return (
    <section className="formulaire" aria-label="Suivi et interventions">
      <h3>Suivi</h3>
      <ol className="chronologie">
        {suivi.historique.map((h, i) => (
          <li key={i}>
            <strong>{h.ancien === h.nouveau ? 'Note' : STATUTS[h.nouveau].libelle}</strong>
            <span className="discret"> · {formatDate(h.date)}{h.acteurRole ? ` · ${ROLES[h.acteurRole] ?? h.acteurRole}` : ''}</span>
            {h.motif && <div>{h.motif}</div>}
          </li>
        ))}
      </ol>
      {suivi.livreeLe && (
        <dl className="details">
          <dt>Remise</dt><dd>{formatDate(suivi.livreeLe)}{suivi.modeRemise ? ` · ${MODES_REMISE[suivi.modeRemise]}` : ''}</dd>
          <dt>Encaissé</dt>
          <dd>
            {suivi.montantEncaisse != null ? formatMontant(suivi.montantEncaisse) : '—'}
            {suivi.ecartEncaissement ? <span className="discret"> · écart {formatMontant(suivi.ecartEncaissement)} : {suivi.motifEcart}</span> : null}
          </dd>
        </dl>
      )}

      {suivi.actions.length > 0 && !action && (
        <div className="pied-modale">
          {suivi.actions.map((a) => (
            <button key={a} className={`bouton ${a === 'ANNULER' ? 'secondaire' : 'plein'}`} onClick={() => setAction(a)}>
              {LIBELLES_ACTIONS[a]}
            </button>
          ))}
        </div>
      )}
      {action && (
        <FormulaireIntervention
          action={action}
          suivi={suivi}
          onAnnuler={() => setAction(null)}
          onFaite={(s) => { setSuivi(s); setAction(null); onModifiee(); }}
        />
      )}
    </section>
  );
}

function FormulaireIntervention({ action, suivi, onAnnuler, onFaite }: {
  action: ActionResponsable; suivi: SuiviResponsable; onAnnuler: () => void; onFaite: (suivi: SuiviResponsable) => void;
}) {
  const [motif, setMotif] = useState('');
  const [montant, setMontant] = useState(String(suivi.montantAttendu));
  const [motifEcart, setMotifEcart] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const encaisse = lireMontant(montant);
  const ecart = encaisse == null ? 0 : (Math.round(encaisse * 1000) - Math.round(suivi.montantAttendu * 1000)) / 1000;
  const valide = motif.trim().length >= MOTIF_MIN
    && (action !== 'VALIDER_REMISE' || (encaisse != null && (ecart === 0 || motifEcart.trim().length >= MOTIF_MIN)));

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const id = suivi.commandeId;
      onFaite(action === 'ANNULER' ? await api.annulerCommande(id, motif.trim())
        : action === 'VALIDER_COLLECTE' ? await api.validerCollecte(id, motif.trim())
        : await api.validerRemise(id, motif.trim(), encaisse ?? 0, ecart === 0 ? null : motifEcart.trim()));
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Intervention impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form className="formulaire" onSubmit={(e) => void envoyer(e)}>
      <h3>{LIBELLES_ACTIONS[action]}</h3>
      <p className="discret">{AIDES_ACTIONS[action]}</p>
      {erreur && <Alerte message={erreur} />}
      <Champ libelle="Motif" aide={`${MOTIF_MIN} caractères minimum, conservé dans l’historique et l’audit.`}>
        <textarea value={motif} maxLength={300} rows={2} required disabled={envoi} onChange={(e) => setMotif(e.target.value)} />
      </Champ>
      {action === 'VALIDER_REMISE' && (
        <>
          <Champ libelle={`Montant encaissé (total ${formatMontant(suivi.montantAttendu)})`}>
            <input value={montant} inputMode="decimal" required disabled={envoi} onChange={(e) => setMontant(e.target.value)} />
          </Champ>
          {encaisse != null && ecart !== 0 && (
            <Champ libelle={`Motif de l’écart (${ecart > 0 ? '+' : ''}${formatMontant(ecart)})`}>
              <input value={motifEcart} maxLength={300} required disabled={envoi} onChange={(e) => setMotifEcart(e.target.value)} />
            </Champ>
          )}
        </>
      )}
      <div className="pied-modale">
        <button type="button" className="bouton secondaire" onClick={onAnnuler} disabled={envoi}>Retour</button>
        <button type="submit" className="bouton plein" disabled={!valide || envoi}>{envoi ? 'Envoi…' : 'Confirmer'}</button>
      </div>
    </form>
  );
}
