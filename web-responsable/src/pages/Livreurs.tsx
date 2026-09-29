import { useCallback, useState, type FormEvent } from 'react';
import { api } from '../api';
import { Alerte, BadgeActif, Champ, EnTete, EtatTableau, Modale, useDonnees } from '../composants/ui';
import type { Livreur, LivreurRequest, Vehicule } from '../types';

// US-02 : gestion des comptes livreurs ; US-03 : association d'un vehicule a un livreur
export default function Livreurs() {
  const charger = useCallback(() => Promise.all([api.livreurs(), api.vehicules()]), []);
  const { donnees, erreur, chargement, recharger } = useDonnees(charger);
  const [livreurs, vehicules] = donnees ?? [[], []];
  const [edition, setEdition] = useState<Livreur | 'nouveau' | null>(null);
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

  function changerVehicule(livreur: Livreur, valeur: string) {
    void agir(livreur.id, () => (valeur
      ? api.affecterVehicule(livreur.id, Number(valeur))
      : api.retirerVehicule(livreur.id)));
  }

  return (
    <>
      <EnTete titre="Livreurs" sousTitre="Comptes des livreurs et véhicule associé">
        <button className="bouton plein" onClick={() => setEdition('nouveau')}>Ajouter un livreur</button>
      </EnTete>

      {erreurAction && <Alerte message={erreurAction} onFermer={() => setErreurAction(null)} />}

      <div className="carte">
        <EtatTableau chargement={chargement && !donnees} erreur={erreur} vide={livreurs.length === 0}
          messageVide="Aucun livreur. Ajoutez le premier compte." onReessayer={() => void recharger()} />
        {livreurs.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Téléphone</th>
                <th>Véhicule</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {livreurs.map((l) => (
                <tr key={l.id} className={l.actif ? '' : 'estompe'}>
                  <td><strong>{l.prenom} {l.nom}</strong></td>
                  <td>{l.email}</td>
                  <td>{l.telephone || <span className="discret">—</span>}</td>
                  <td>
                    <SelectVehicule livreur={l} vehicules={vehicules} desactive={enCours === l.id} onChange={(v) => changerVehicule(l, v)} />
                  </td>
                  <td><BadgeActif actif={l.actif} /></td>
                  <td className="actions-ligne">
                    <button className="bouton-lien" onClick={() => setEdition(l)}>Modifier</button>
                    <button className="bouton-lien" disabled={enCours === l.id}
                      onClick={() => void agir(l.id, () => (l.actif
                        ? api.desactiverLivreur(l.id) : api.activerLivreur(l.id)))}>
                      {l.actif ? 'Désactiver' : 'Activer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edition && (
        <FormulaireLivreur livreur={edition === 'nouveau' ? null : edition} onFermer={() => setEdition(null)}
          onEnregistre={() => { setEdition(null); void recharger(); }} />
      )}
    </>
  );
}

function SelectVehicule({ livreur, vehicules, desactive, onChange }: {
  livreur: Livreur;
  vehicules: Vehicule[];
  desactive: boolean;
  onChange: (vehiculeId: string) => void;
}) {
  // Vehicules actifs ; ceux deja pris par un autre livreur restent choisissables (ils seront reaffectes).
  const choix = vehicules.filter((v) => v.actif || v.id === livreur.vehiculeId);
  return (
    <select className="select-compact" value={livreur.vehiculeId ?? ''} disabled={desactive}
      onChange={(e) => onChange(e.target.value)}>
      <option value="">Aucun véhicule</option>
      {choix.map((v) => (
        <option key={v.id} value={v.id}>
          {v.immatriculation}{v.type ? ` · ${v.type}` : ''}
          {v.livreurId && v.livreurId !== livreur.id ? ' (déjà affecté)' : ''}
          {!v.actif ? ' (inactif)' : ''}
        </option>
      ))}
    </select>
  );
}

function FormulaireLivreur({ livreur, onFermer, onEnregistre }: {
  livreur: Livreur | null;
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const [form, setForm] = useState<LivreurRequest>({
    nom: livreur?.nom ?? '',
    prenom: livreur?.prenom ?? '',
    email: livreur?.email ?? '',
    telephone: livreur?.telephone ?? '',
    motDePasse: '',
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = (champ: keyof LivreurRequest) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [champ]: e.target.value }));

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (form.motDePasse && form.motDePasse.length < 8) {
      setErreur('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      const donnees = { ...form, motDePasse: form.motDePasse || undefined };
      if (livreur) await api.modifierLivreur(livreur.id, donnees);
      else await api.creerLivreur(donnees);
      onEnregistre();
    } catch (err) {
      setErreur((err as Error).message);
      setEnvoi(false);
    }
  }

  return (
    <Modale titre={livreur ? 'Modifier le livreur' : 'Nouveau livreur'} onFermer={onFermer}>
      <form className="formulaire" onSubmit={soumettre}>
        {erreur && <Alerte message={erreur} />}
        <div className="grille-2">
          <Champ libelle="Prénom"><input required value={form.prenom} onChange={maj('prenom')} autoFocus /></Champ>
          <Champ libelle="Nom"><input required value={form.nom} onChange={maj('nom')} /></Champ>
        </div>
        <Champ libelle="Email" aide={livreur ? "L'email sert d'identifiant et ne peut pas être modifié." : undefined}>
          <input type="email" required value={form.email} onChange={maj('email')} disabled={!!livreur} />
        </Champ>
        <Champ libelle="Téléphone"><input type="tel" value={form.telephone} onChange={maj('telephone')} /></Champ>
        <Champ libelle="Mot de passe"
          aide={livreur ? 'Laisser vide pour conserver le mot de passe actuel.' : '8 caractères minimum.'}>
          <input type="password" autoComplete="new-password" required={!livreur} minLength={8}
            value={form.motDePasse} onChange={maj('motDePasse')} />
        </Champ>
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
