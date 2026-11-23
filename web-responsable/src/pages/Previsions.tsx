import { Chiffre, StatHero, StatTuile } from '../composants/luxe';
import { api } from '../api';
import { EnTete, EtatTableau, useDonnees } from '../composants/ui';

export default function Previsions() {
  const alertes = useDonnees(api.alertesCouverture);
  const prospects = useDonnees(api.prospects);
  const aContacter = (prospects.donnees ?? []).filter(p => p.statut === 'A_CONTACTER').length;

  return (
    <>
      <EnTete titre="Prévisions et prospection" sousTitre="Où la demande dépasse la capacité des coursiers, et quels commerces démarcher." />
      <div className="bande-vedette">
        <StatHero legende="Alertes de couverture" valeur={alertes.donnees ? <Chiffre valeur={alertes.donnees.length} /> : '—'} pastille="Aujourd’hui"
          note={<><b>{(alertes.donnees ?? []).reduce((n, a) => n + a.renfortRecommande, 0)}</b> coursier(s) de renfort conseillé(s)</>} />
        <StatTuile legende="Commandes prévues" valeur={<Chiffre valeur={(alertes.donnees ?? []).reduce((n, a) => n + a.commandesPrevues, 0)} />} note="sur les créneaux en tension" ton={alertes.donnees?.length ? 'danger' : 'succes'} delta="Demande" />
        <StatTuile legende="Prospects à contacter" valeur={<Chiffre valeur={aContacter} />} note={`sur ${prospects.donnees?.length ?? '—'} prospects importés`} ton="accent" delta="Pipeline" />
      </div>
      <div className="carte">
        <h2>Créneaux sous-couverts</h2>
        <EtatTableau chargement={alertes.chargement} erreur={alertes.erreur} vide={!alertes.donnees?.length} messageVide="Aucun créneau en tension aujourd’hui." onReessayer={() => void alertes.recharger()} />
        {!!alertes.donnees?.length && (
          <table>
            <thead><tr><th>Zone</th><th>Heure</th><th>Commandes prévues</th><th>Coursiers disponibles</th><th>Renfort conseillé</th></tr></thead>
            <tbody>
              {alertes.donnees.map(a => (
                <tr key={a.zoneId + '-' + a.heure}>
                  <td>{a.zone}</td>
                  <td>{a.heure} h</td>
                  <td>{a.commandesPrevues.toFixed(1)}</td>
                  <td>{a.coursiersDisponibles}</td>
                  <td><strong>+{a.renfortRecommande}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="carte">
        <h2>Prospects classés par score</h2>
        <EtatTableau chargement={prospects.chargement} erreur={prospects.erreur} vide={!prospects.donnees?.length} messageVide="Aucun prospect importé." onReessayer={() => void prospects.recharger()} />
        {!!prospects.donnees?.length && (
          <table>
            <thead><tr><th>Nom</th><th>Catégorie</th><th>Zone</th><th>Score</th><th>Statut</th></tr></thead>
            <tbody>
              {[...prospects.donnees].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map(p => (
                <tr key={p.id}>
                  <td>{p.nom}</td>
                  <td>{p.categorie}</td>
                  <td>{p.zone ?? '—'}</td>
                  <td>{p.score == null ? '—' : Math.round(p.score * 100) + ' %'}</td>
                  <td><span className="etat">{p.statut}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
