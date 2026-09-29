import { useCallback, useState, type FormEvent } from 'react';
import { api } from '../api';
import { Alerte, BadgeActif, Champ, EnTete, EtatTableau, Modale, useDonnees } from '../composants/ui';
import { formatNombre } from '../format';
import type { Vehicule, VehiculeRequest } from '../types';

// US-03 : gestion des vehicules (l'association a un livreur se fait aussi depuis la page Livreurs)
export default function Vehicules() {
  const charger = useCallback(() => Promise.all([api.vehicules(), api.livreurs()]), []);
  const { donnees, erreur, chargement, recharger } = useDonnees(charger);
  const [vehicules, livreurs] = donnees ?? [[], []];
  const [edition, setEdition] = useState<Vehicule | 'nouveau' | null>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<number | null>(null);

  async function agir(id: number, action: () => Promise<unknown>) {
    setErreurAction(null);
    setEnCours(id);
    try {
      await action();
      await recharger();
    } catch (e) {
      setErreurAction((e as Error).message);
    } finally {
      setEnCours(null);
    }
  }

  function changerLivreur(vehicule: Vehicule, valeur: string) {
    void agir(vehicule.id, () => (valeur
      ? api.affecterVehicule(Number(valeur), vehicule.id)
      : api.retirerVehicule(vehicule.livreurId!)));
  }

  return (
    <>
      <EnTete titre="Véhicules" sousTitre="Flotte et affectation aux livreurs">
        <button className="bouton plein" onClick={() => setEdition('nouveau')}>Ajouter un véhicule</button>
      </EnTete>

      {erreurAction && <Alerte message={erreurAction} onFermer={() => setErreurAction(null)} />}

      <div className="carte">
        <EtatTableau chargement={chargement && !donnees} erreur={erreur} vide={vehicules.length === 0}
          messageVide="Aucun véhicule. Ajoutez le premier." onReessayer={() => void recharger()} />
        {vehicules.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Immatriculation</th>
                <th>Type</th>
                <th className="nombre">Capacité</th>
                <th className="nombre">Consommation</th>
                <th>Livreur</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vehicules.map((v) => (
                <tr key={v.id} className={v.actif ? '' : 'estompe'}>
                  <td><span className="plaque">{v.immatriculation}</span></td>
                  <td>{v.type || <span className="discret">—</span>}</td>
                  <td className="nombre">{v.capaciteKg != null ? `${formatNombre(v.capaciteKg)} kg` : '—'}</td>
                  <td className="nombre">{formatNombre(v.consommationLitres100Km)} L/100 km</td>
                  <td>
                    <select className="select-compact" value={v.livreurId ?? ''}
                      disabled={enCours === v.id || (!v.actif && !v.livreurId)}
                      title={!v.actif ? 'Activez le véhicule pour l’affecter' : undefined}
                      onChange={(e) => changerLivreur(v, e.target.value)}>
                      <option value="">Non affecté</option>
                      {livreurs.filter((l) => l.actif || l.id === v.livreurId).map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.prenom} {l.nom}{l.vehiculeId && l.vehiculeId !== v.id ? ' (a déjà un véhicule)' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td><BadgeActif actif={v.actif} /></td>
                  <td className="actions-ligne">
                    <button className="bouton-lien" onClick={() => setEdition(v)}>Modifier</button>
                    <button className="bouton-lien" disabled={enCours === v.id}
                      onClick={() => void agir(v.id, () => (v.actif
                        ? api.desactiverVehicule(v.id) : api.activerVehicule(v.id)))}>
                      {v.actif ? 'Désactiver' : 'Activer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edition && (
        <FormulaireVehicule vehicule={edition === 'nouveau' ? null : edition} onFermer={() => setEdition(null)}
          onEnregistre={() => { setEdition(null); void recharger(); }} />
      )}
    </>
  );
}

function FormulaireVehicule({ vehicule, onFermer, onEnregistre }: {
  vehicule: Vehicule | null;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const [immatriculation, setImmatriculation] = useState(vehicule?.immatriculation ?? '');
  const [type, setType] = useState(vehicule?.type ?? '');
  const [capacite, setCapacite] = useState(vehicule?.capaciteKg?.toString() ?? '');
  const [consommation, setConsommation] = useState(vehicule?.consommationLitres100Km?.toString() ?? '');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    const donnees: VehiculeRequest = {
      immatriculation: immatriculation.trim(),
      type: type.trim() || undefined,
      capaciteKg: capacite ? Number(capacite) : undefined,
      consommationLitres100Km: consommation ? Number(consommation) : undefined,
    };
    try {
      if (vehicule) await api.modifierVehicule(vehicule.id, donnees);
      else await api.creerVehicule(donnees);
      onEnregistre();
    } catch (err) {
      setErreur((err as Error).message);
      setEnvoi(false);
    }
  }

  return (
    <Modale titre={vehicule ? 'Modifier le véhicule' : 'Nouveau véhicule'} onFermer={onFermer}>
      <form className="formulaire" onSubmit={soumettre}>
        {erreur && <Alerte message={erreur} />}
        <Champ libelle="Immatriculation">
          <input required value={immatriculation} onChange={(e) => setImmatriculation(e.target.value)}
            placeholder="123 TU 4567" autoFocus />
        </Champ>
        <Champ libelle="Type">
          <input value={type} onChange={(e) => setType(e.target.value)} placeholder="Scooter, voiture, utilitaire…"
            list="types-vehicule" />
          <datalist id="types-vehicule">
            <option value="Scooter" /><option value="Voiture" /><option value="Utilitaire" />
          </datalist>
        </Champ>
        <div className="grille-2">
          <Champ libelle="Capacité (kg)">
            <input type="number" min={0} step="any" value={capacite} onChange={(e) => setCapacite(e.target.value)} />
          </Champ>
          <Champ libelle="Consommation (L/100 km)" aide="Entre 2 et 30. Sert au calcul des frais.">
            <input type="number" min={2} max={30} step="0.1" value={consommation}
              onChange={(e) => setConsommation(e.target.value)} />
          </Champ>
        </div>
        <div className="pied-modale">
          <button type="button" className="bouton secondaire" onClick={onFermer}>Annuler</button>
          <button type="submit" className="bouton plein" disabled={envoi}>
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modale>
  );
}
