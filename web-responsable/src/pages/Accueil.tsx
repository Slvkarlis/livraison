import { Link } from 'react-router-dom';
import { api } from '../api';
import { EnTete, EtatTableau, useDonnees } from '../composants/ui';
import { formatMontant } from '../format';
import type { Livraison } from '../types';

const EN_COURS = ['ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'AFFECTEE', 'RECUPEREE', 'A_PROXIMITE', 'EN_COURS', 'ARRIVEE'];
const LIBELLES: Record<string, string> = {
  PENDING_PARTNER: 'En attente', ACCEPTEE: 'Acceptée', EN_PREPARATION: 'Préparation', PRETE: 'Prête', AFFECTEE: 'Affectée',
  RECUPEREE: 'Récupérée', A_PROXIMITE: 'À proximité', EN_COURS: 'En route', ARRIVEE: 'Arrivée', LIVREE: 'Livrée',
  ECHEC: 'Échec', ANNULEE: 'Annulée', REFUSEE: 'Refusée', RETOURNEE: 'Retournée',
};

export default function Accueil() {
  const commandes = useDonnees(api.livraisons);
  const echecs = useDonnees(api.echecs);
  const liste: Livraison[] = commandes.donnees ?? [];
  const livrees = liste.filter(c => c.statut === 'LIVREE');
  const enCours = liste.filter(c => EN_COURS.includes(c.statut));
  const aDecider = (echecs.donnees ?? []).filter(e => !e.decision);
  const montantLivre = livrees.reduce((somme, c) => somme + (c.montantTotal ?? 0), 0);
  const taux = liste.length ? Math.round((livrees.length / liste.length) * 100) : 0;
  const recentes = [...liste].sort((a, b) => b.id - a.id).slice(0, 6);
  const aujourdhui = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <EnTete titre="Tableau de bord" sousTitre={`${aujourdhui} · vue d’ensemble de l’activité`}>
        <Link className="bouton" to="/commandes">Voir les commandes</Link>
      </EnTete>

      <div className="bi-grille">
        <article className="bi-indicateur">
          <h2>Commandes livrées</h2>
          <strong>{livrees.length}</strong>
          <p>{taux} % des {liste.length} commandes enregistrées</p>
        </article>
        <article className="bi-indicateur">
          <h2>En cours</h2>
          <strong>{enCours.length}</strong>
          <p>préparation, affectation ou route</p>
        </article>
        <article className="bi-indicateur">
          <h2>Montant livré</h2>
          <strong>{formatMontant(montantLivre)}</strong>
          <p>total des commandes livrées</p>
        </article>
        <article className="bi-indicateur">
          <h2>Échecs à décider</h2>
          <strong>{aDecider.length}</strong>
          <p>{aDecider.length ? 'Relivraison, retour ou perte' : 'Aucun échec en attente'}</p>
        </article>
      </div>

      <div className="accueil-bas">
        <div className="carte inclinable">
          <h2>Dernières commandes</h2>
          <EtatTableau chargement={commandes.chargement} erreur={commandes.erreur} vide={!recentes.length} messageVide="Aucune commande pour le moment." onReessayer={() => void commandes.recharger()} />
          {!!recentes.length && (
            <table>
              <thead><tr><th>Code</th><th>Commerce</th><th>Zone</th><th>Statut</th><th>Total</th></tr></thead>
              <tbody>
                {recentes.map(c => (
                  <tr key={c.id}>
                    <td className="mono">{c.codeSuivi}</td>
                    <td>{c.nomPartenaire ?? 'Commande directe'}</td>
                    <td>{c.zoneNom ?? '—'}</td>
                    <td><span className={'etat etat-' + (c.statut === 'LIVREE' ? 'ok' : c.statut === 'ECHEC' || c.statut === 'ANNULEE' ? 'ko' : 'cours')}>{LIBELLES[c.statut] ?? c.statut}</span></td>
                    <td>{formatMontant(c.montantTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="carte inclinable">
          <h2>Échecs de livraison</h2>
          <EtatTableau chargement={echecs.chargement} erreur={echecs.erreur} vide={!aDecider.length} messageVide="Aucun échec en attente de décision." onReessayer={() => void echecs.recharger()} />
          <ul className="liste-alertes">
            {aDecider.slice(0, 5).map(e => (
              <li key={e.id}>
                <span className="etat etat-ko">{e.motif}</span>
                <span>{e.codeSuivi} · {e.nomCommerce}</span>
              </li>
            ))}
          </ul>
          {aDecider.length > 0 && <Link className="bouton-lien" to="/echecs">Décider maintenant</Link>}
        </div>
      </div>
    </>
  );
}
