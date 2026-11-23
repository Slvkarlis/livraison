import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { CarteVille3D } from '../composants/CarteVille3D';
import { Chiffre, FriseTrajet, LigneCommande, Panneau, Pastille, StatHero, StatTuile } from '../composants/luxe';
import { EN_COURS, EN_ROUTE, heure, initiale, progression, tonStatut } from '../composants/statuts';
import { EtatTableau, useDonnees } from '../composants/ui';
import { formatDistance, formatMontant, STATUTS } from '../format';
import { useSession } from '../session';
import type { Livraison } from '../types';

/** Tableau de bord (conception Doop « Direction 1 ») : chiffres reels des commandes et des echecs. */
export default function Accueil() {
  const { profil } = useSession();
  const navigate = useNavigate();
  const commandes = useDonnees(api.livraisons);
  const echecs = useDonnees(api.echecs);
  const liste: Livraison[] = commandes.donnees ?? [];
  const livrees = liste.filter(c => c.statut === 'LIVREE');
  const enCours = liste.filter(c => EN_COURS.includes(c.statut));
  const terminees = liste.filter(c => ['LIVREE', 'ECHEC', 'RETOURNEE'].includes(c.statut));
  const reussite = terminees.length ? Math.round((livrees.length / terminees.length) * 100) : 0;
  const aDecider = (echecs.donnees ?? []).filter(e => !e.decision);
  const montantLivre = livrees.reduce((s, c) => s + (c.montantTotal ?? 0), 0);
  const recentes = [...liste].sort((a, b) => b.id - a.id).slice(0, 6);
  const enRoute = [...liste].filter(c => EN_ROUTE.includes(c.statut)).sort((a, b) => b.id - a.id)[0];
  const parJour = derniersJours(liste);

  const parZone = Object.entries(liste.reduce<Record<string, number>>((acc, c) => {
    const z = c.zoneNom ?? 'Hors zone'; acc[z] = (acc[z] ?? 0) + 1; return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxZone = Math.max(1, ...parZone.map(([, n]) => n));

  const h = new Date().getHours();
  const salut = h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour';

  return (
    <>
      <header className="tdb-titre">
        <h1>{salut} {profil?.prenom ?? ''}<span>voici la ville {h >= 18 ? 'ce soir' : 'aujourd’hui'}.</span></h1>
        <div className="actions">
          <Link className="bouton secondaire" to="/dispatch">Dispatch</Link>
          <Link className="bouton" to="/commandes">Voir les commandes <span className="fleche" aria-hidden="true">→</span></Link>
        </div>
      </header>

      <section className="tdb-heros">
        <StatHero legende="Commandes livrées" valeur={<Chiffre valeur={livrees.length} />}
          note={<><b>{reussite} %</b> de réussite sur {terminees.length} commande{terminees.length > 1 ? 's' : ''} terminée{terminees.length > 1 ? 's' : ''}</>} />
        <StatTuile legende="En cours" valeur={<Chiffre valeur={enCours.length} />} note="préparation, affectation ou en route"
          delta={`${liste.length} au total`} ton="accent" serie={parJour} />
        <StatTuile legende="Montant livré" valeur={<Chiffre valeur={montantLivre} format={v => formatMontant(v).replace(/\s?DT$/, '')} />} unite="DT"
          note="total des commandes livrées, frais compris" delta={aDecider.length ? `${aDecider.length} échec${aDecider.length > 1 ? 's' : ''} à décider` : 'Aucun échec en attente'}
          ton={aDecider.length ? 'danger' : 'succes'} />
      </section>

      <section className="tdb-bas">
        <Panneau titre="Commandes en direct" action={<Pastille ton="accent" pulse>{enCours.length} en cours</Pastille>}>
          <EtatTableau chargement={commandes.chargement} erreur={commandes.erreur} vide={!recentes.length} messageVide="Aucune commande pour le moment." onReessayer={() => void commandes.recharger()} />
          {recentes.map((c, i) => (
            <LigneCommande key={c.id} rang={i} initiale={initiale(c)} titre={c.nomPartenaire ?? c.clientEmail} code={c.codeSuivi}
              zone={c.zoneNom ?? 'Hors zone'} heure={heure(c.dateCreation)} etat={STATUTS[c.statut].libelle} ton={tonStatut(c.statut)}
              montant={formatMontant(c.montantTotal)} onClick={() => navigate(`/commandes?id=${c.id}`)} />
          ))}
          {!!recentes.length && <div className="tdb-pied"><span>Actualisé en direct</span><Link to="/commandes">Voir les {liste.length} commandes →</Link></div>}
        </Panneau>

        <div className="duo">
          <div className="duo-nuit">
            <CarteVille3D />
            <div className="in">
              <div className="h"><strong>{enRoute ? 'Livraison en cours' : 'Aucune livraison en route'}</strong>{enRoute && <Pastille ton="verre" pulse>{enRoute.codeSuivi}</Pastille>}</div>
              {enRoute
                ? <FriseTrajet depart={heure(enRoute.creneauDebut)} arrivee={heure(enRoute.creneauFin)} duree={STATUTS[enRoute.statut].libelle}
                    de={enRoute.nomPartenaire ?? 'Départ'} vers={enRoute.adresse} distance={formatDistance(enRoute.distanceKm)} progression={progression(enRoute.statut)} />
                : <p style={{ color: 'var(--sur-nuit-discret)' }}>Dès qu’un livreur récupère un colis, son trajet apparaît ici.</p>}
            </div>
          </div>
          <div className="duo-jour">
            <span className="av">{enRoute ? initiale(enRoute) : '—'}</span>
            <div><strong>{enRoute ? enRoute.nomPartenaire ?? 'Commande directe' : 'Flotte au repos'}</strong><small>{enRoute ? `${enRoute.zoneNom ?? 'Hors zone'} · ${formatMontant(enRoute.montantTotal)}` : 'Aucun trajet actif'}</small></div>
            {enRoute && <Pastille ton="accent">{formatDistance(enRoute.distanceKm)}</Pastille>}
          </div>
        </div>

        <Panneau titre="Commandes par zone">
          {parZone.length === 0 ? <p className="discret">Pas encore de données.</p> : (
            <div className="barres">
              {parZone.map(([zone, n], i) => (
                <div key={zone} className="barre-zone"><span>{zone}</span><div className="piste"><span style={{ width: `${(n / maxZone) * 100}%`, animationDelay: `${.2 + i * .08}s` }} /></div><b>{n}</b></div>
              ))}
            </div>
          )}
        </Panneau>

        <Panneau titre="Échecs à décider" action={aDecider.length > 0 && <Link to="/echecs">Décider →</Link>}>
          <EtatTableau chargement={echecs.chargement} erreur={echecs.erreur} vide={!aDecider.length} messageVide="Aucun échec en attente de décision." onReessayer={() => void echecs.recharger()} />
          {aDecider.slice(0, 4).map((e, i) => (
            <LigneCommande key={e.id} rang={i} initiale={(e.nomCommerce ?? '?').charAt(0)} titre={e.nomCommerce ?? 'Commerce'} code={e.codeSuivi}
              zone={e.motif} heure="" etat="À décider" ton="danger" montant="" onClick={() => navigate('/echecs')} />
          ))}
        </Panneau>
      </section>
    </>
  );
}

/** Nombre de commandes creees sur chacun des 7 derniers jours (pour l'etincelle). */
function derniersJours(liste: Livraison[]): number[] {
  const jours = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toDateString(); });
  return jours.map(j => liste.filter(c => new Date(c.dateCreation).toDateString() === j).length);
}
