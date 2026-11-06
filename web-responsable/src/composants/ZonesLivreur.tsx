import { useCallback, useState, type FormEvent } from 'react';
import { api } from '../api';
import { formatDate } from '../format';
import type { AffectationZone, Livreur, TypeAffectation } from '../types';
import { Alerte, Badge, Champ, Modale, useDonnees } from './ui';

const TYPES: Record<TypeAffectation, { libelle: string; couleur: string; fond: string; aide: string }> = {
  PRINCIPALE: { libelle: 'Principale', couleur: '#1D4ED8', fond: '#DBEAFE', aide: 'Zone habituelle du livreur (une seule).' },
  SECONDAIRE: { libelle: 'Secondaire', couleur: '#4B5563', fond: '#F3F4F6', aide: 'Zone où il peut aussi travailler.' },
  TEMPORAIRE: { libelle: 'Renfort', couleur: '#B45309', fond: '#FEF3C7', aide: 'Renfort ponctuel entre deux dates.' },
};

// US-2B11 : zones de travail d'un livreur (principale, secondaires, renforts temporaires)
export function ZonesLivreur({ livreur, onFermer, onModifie }: {
  livreur: Livreur;
  onFermer: () => void;
  /** Appele apres chaque ajout ou retrait (la liste des livreurs affiche la zone principale). */
  onModifie: () => void;
}) {
  const charger = useCallback(() => Promise.all([api.zonesLivreur(livreur.id), api.zones()]), [livreur.id]);
  const { donnees, erreur, chargement, recharger } = useDonnees(charger);
  const [affectations, zones] = donnees ?? [[], []];
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [retraitEnCours, setRetraitEnCours] = useState<number | null>(null);

  async function apresModification() {
    await recharger();
    onModifie();
  }

  async function retirer(affectation: AffectationZone) {
    setErreurAction(null);
    setRetraitEnCours(affectation.id);
    try {
      await api.retirerAffectation(livreur.id, affectation.id);
      await apresModification();
    } catch (e) {
      setErreurAction((e as Error).message);
    } finally {
      setRetraitEnCours(null);
    }
  }

  const zonesLibres = zones.filter((z) => !affectations.some((a) => a.zoneId === z.id));
  const aUnePrincipale = affectations.some((a) => a.type === 'PRINCIPALE');

  return (
    <Modale titre={`Zones de ${livreur.prenom} ${livreur.nom}`} onFermer={onFermer}>
      {erreur && <Alerte message={erreur} />}
      {erreurAction && <Alerte message={erreurAction} onFermer={() => setErreurAction(null)} />}

      {chargement && !donnees ? <p className="discret">Chargement…</p> : (
        <ul className="liste-affectations">
          {affectations.length === 0 && <li className="discret">Aucune zone : ce livreur ne peut pas encore se déclarer disponible.</li>}
          {affectations.map((a) => (
            <li key={a.id} className={a.enVigueur ? '' : 'estompe'}>
              <div>
                <strong>{a.zoneNom}</strong>{' '}
                <Badge texte={TYPES[a.type].libelle} couleur={TYPES[a.type].couleur} fond={TYPES[a.type].fond} />
                {a.type === 'TEMPORAIRE' && a.debut && a.fin && (
                  <div className="discret">
                    Du {formatDate(a.debut)} au {formatDate(a.fin)}{a.enVigueur ? ' · en cours' : ''}
                  </div>
                )}
              </div>
              <button className="bouton-lien" disabled={retraitEnCours === a.id} onClick={() => void retirer(a)}>Retirer</button>
            </li>
          ))}
        </ul>
      )}

      <FormulaireAffectation livreurId={livreur.id} zonesLibres={zonesLibres} aUnePrincipale={aUnePrincipale}
        onAjoutee={() => void apresModification()} />
    </Modale>
  );
}

function FormulaireAffectation({ livreurId, zonesLibres, aUnePrincipale, onAjoutee }: {
  livreurId: number;
  zonesLibres: { id: number; nom: string }[];
  aUnePrincipale: boolean;
  onAjoutee: () => void;
}) {
  const [zoneId, setZoneId] = useState('');
  const [type, setType] = useState<TypeAffectation>(aUnePrincipale ? 'SECONDAIRE' : 'PRINCIPALE');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    const temporaire = type === 'TEMPORAIRE';
    if (temporaire && (!debut || !fin || new Date(fin) <= new Date(debut))) {
      setErreur('Un renfort a une date de début et une date de fin postérieure.');
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      // datetime-local est en heure locale ; l'API attend des instants ISO
      await api.affecterZone(livreurId, {
        zoneId: Number(zoneId),
        type,
        ...(temporaire ? { debut: new Date(debut).toISOString(), fin: new Date(fin).toISOString() } : {}),
      });
      setZoneId('');
      setDebut('');
      setFin('');
      setType('SECONDAIRE');
      onAjoutee();
    } catch (err) {
      setErreur((err as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  if (zonesLibres.length === 0) {
    return <p className="discret">Toutes les zones sont déjà affectées à ce livreur.</p>;
  }

  return (
    <form className="formulaire" onSubmit={soumettre}>
      <h3>Ajouter une zone</h3>
      {erreur && <Alerte message={erreur} />}
      <div className="grille-2">
        <Champ libelle="Zone">
          <select required value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">Choisir…</option>
            {zonesLibres.map((z) => <option key={z.id} value={z.id}>{z.nom}</option>)}
          </select>
        </Champ>
        <Champ libelle="Type" aide={TYPES[type].aide}>
          <select value={type} onChange={(e) => setType(e.target.value as TypeAffectation)}>
            <option value="PRINCIPALE" disabled={aUnePrincipale}>Principale{aUnePrincipale ? ' (déjà définie)' : ''}</option>
            <option value="SECONDAIRE">Secondaire</option>
            <option value="TEMPORAIRE">Renfort temporaire</option>
          </select>
        </Champ>
      </div>
      {type === 'TEMPORAIRE' && (
        <div className="grille-2">
          <Champ libelle="Début"><input type="datetime-local" required value={debut} onChange={(e) => setDebut(e.target.value)} /></Champ>
          <Champ libelle="Fin"><input type="datetime-local" required value={fin} onChange={(e) => setFin(e.target.value)} /></Champ>
        </div>
      )}
      <div className="pied-modale">
        <button type="submit" className="bouton plein" disabled={envoi}>{envoi ? 'Ajout…' : 'Ajouter la zone'}</button>
      </div>
    </form>
  );
}
