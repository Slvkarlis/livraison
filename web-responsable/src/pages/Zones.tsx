import { useCallback, useMemo, useState } from 'react';
import { Chiffre, StatHero, StatTuile } from '../composants/luxe';
import { api } from '../api';
import { Alerte, EnTete, EtatTableau, Modale, useDonnees } from '../composants/ui';
import CarteZones from '../composants/CarteZones';
import { verifierZone, type Position, type Zone } from '../../../mobile/packages/shared/src/sprint2';
import { formatMontant } from '../format';

export default function Zones() {
  const { donnees, erreur, chargement, recharger } = useDonnees(api.zones);
  const [edition, setEdition] = useState<Zone | 'nouvelle' | null>(null), [suppression, setSuppression] = useState<Zone | null>(null);
  const [nom, setNom] = useState(''), [frais, setFrais] = useState('3'), [trace, setTrace] = useState('');
  const [vitesse, setVitesse] = useState('20');
  const [envoi, setEnvoi] = useState(false), [echec, setEchec] = useState<string | null>(null), [succes, setSucces] = useState('');
  const points = useMemo(() => trace.trim() ? trace.trim().split('\n').map(l => {
    const valeurs = l.split(',');
    const latitude = valeurs.length === 2 && valeurs[0].trim() ? Number(valeurs[0]) : NaN;
    const longitude = valeurs.length === 2 && valeurs[1].trim() ? Number(valeurs[1]) : NaN;
    return { latitude, longitude };
  }) : [], [trace]);
  const onPoints = useCallback((p: Position[]) => setTrace(p.map(x => x.latitude + ',' + x.longitude).join('\n')), []);
  function ouvrir(zone: Zone | 'nouvelle') { setEdition(zone); setEchec(null); setNom(zone === 'nouvelle' ? '' : zone.nom); setFrais(zone === 'nouvelle' ? '3' : String(zone.fraisLivraison)); setVitesse(zone === 'nouvelle' ? '20' : String(zone.vitesseMoyenneKmh ?? 20)); onPoints(zone === 'nouvelle' ? [] : zone.polygone.slice(0, -1)); }
  async function sauver() {
    const invalide = verifierZone(nom, frais, points); if (invalide) { setEchec(invalide); return; }
    const kmh = Number(vitesse); if (!Number.isFinite(kmh) || kmh < 5 || kmh > 80) { setEchec('Vitesse moyenne : de 5 à 80 km/h.'); return; }
    setEnvoi(true); setEchec(null);
    try { await api.sauverZone(edition === 'nouvelle' || !edition ? null : edition.id, { nom, fraisLivraison: Number(frais), polygone: points, vitesseMoyenneKmh: kmh }); setEdition(null); setSucces('Zone et frais enregistrés. Couverture des partenaires actualisée.'); await recharger(); }
    catch (e) { setEchec((e as Error).message); } finally { setEnvoi(false); }
  }
  return <><EnTete titre="Zones et frais" sousTitre="Les commerces desservent les adresses de leur zone. Les frontières communes sont autorisées."><button className="bouton" onClick={() => ouvrir('nouvelle')}>Créer une zone</button><button className="bouton secondaire" disabled={chargement} onClick={() => void recharger()}>Actualiser</button></EnTete>
    {succes && <p role="status">{succes}</p>}
    {!edition && <CarteZones zones={donnees ?? []} points={[]} edition={false} onPoints={onPoints} />}
    {donnees && <div className="bande-vedette">
      <StatHero legende="Zones desservies" valeur={<Chiffre valeur={donnees.length} />} pastille="Couverture"
        note={<><b>{donnees.reduce((n, z) => n + z.partenaires, 0)}</b> commerce{donnees.reduce((n, z) => n + z.partenaires, 0) > 1 ? 's' : ''} rattaché{donnees.reduce((n, z) => n + z.partenaires, 0) > 1 ? 's' : ''}</>} />
      <StatTuile legende="Frais moyen" valeur={donnees.length ? formatMontant(donnees.reduce((n, z) => n + z.fraisLivraison, 0) / donnees.length) : '—'} note="par livraison, toutes zones" ton="accent" delta="Tarif" />
      <StatTuile legende="Sans commerce" valeur={<Chiffre valeur={donnees.filter(z => !z.partenaires).length} />} note="zones à démarcher en priorité" ton={donnees.some(z => !z.partenaires) ? 'danger' : 'succes'} delta="Prospection" />
    </div>}
    <div className="carte"><EtatTableau chargement={chargement} erreur={erreur} vide={!donnees?.length} messageVide="Aucune zone. Créez une couverture pour ouvrir les commandes." onReessayer={() => void recharger()} />
      {!!donnees?.length && <table><thead><tr><th>Zone</th><th>Frais</th><th>Vitesse moyenne</th><th>Partenaires couverts</th><th>Actions</th></tr></thead><tbody>{donnees.map(z => <tr key={z.id}><td>{z.nom}</td><td>{formatMontant(z.fraisLivraison)}</td><td>{z.vitesseMoyenneKmh ?? 20} km/h</td><td>{z.partenaires}</td><td><button className="bouton-lien" onClick={() => ouvrir(z)}>Modifier {z.nom}</button> <button className="bouton-lien" onClick={() => { setSuppression(z); setEchec(null); }}>Supprimer {z.nom}</button></td></tr>)}</tbody></table>}
    </div>
    {edition && <Modale titre={edition === 'nouvelle' ? 'Créer une zone' : 'Modifier la zone'} onFermer={() => { if (!envoi) setEdition(null); }}>
      <form className="formulaire" onSubmit={e => { e.preventDefault(); void sauver(); }}>
        {echec && <Alerte message={echec} />}
        <label className="champ">Nom de la zone<input aria-label="Nom de la zone" value={nom} maxLength={100} required disabled={envoi} onChange={e => setNom(e.target.value)} /></label>
        <label className="champ">Frais de livraison (DT)<input aria-label="Frais de livraison (DT)" value={frais} type="number" min="0" max="100000" step="0.001" required disabled={envoi} onChange={e => setFrais(e.target.value)} /></label>
        <label className="champ">Vitesse moyenne des livreurs (km/h)<input aria-label="Vitesse moyenne (km/h)" value={vitesse} type="number" min="5" max="80" step="1" required disabled={envoi} onChange={e => setVitesse(e.target.value)} /><small>Sert à l’heure d’arrivée estimée affichée au client.</small></label>
        <p>Tracez le contour sur la carte : il se ferme automatiquement. Les croisements et chevauchements sont refusés à l’enregistrement.</p>
        <CarteZones zones={(donnees ?? []).filter(z => edition === 'nouvelle' || z.id !== edition.id)} points={points.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))} edition={!envoi} onPoints={onPoints} />
        <label className="champ">Sommets : latitude,longitude (un par ligne)<textarea aria-label="Sommets" value={trace} rows={5} disabled={envoi} onChange={e => setTrace(e.target.value)} /></label>
        <div className="actions"><button className="bouton" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer la zone'}</button></div>
      </form>
    </Modale>}
    {suppression && <Modale titre="Supprimer la zone" onFermer={() => { if (!envoi) setSuppression(null); }}><p>Supprimer « {suppression.nom} » ? Une zone couvrant encore des partenaires ne peut pas être supprimée. Les anciennes commandes restent lisibles.</p>{echec && <Alerte message={echec} />}<button className="bouton" disabled={envoi} onClick={() => {
      setEnvoi(true); api.supprimerZone(suppression.id).then(async () => { setSuppression(null); setSucces('Zone supprimée.'); await recharger(); }).catch(e => setEchec(e.message)).finally(() => setEnvoi(false));
    }}>Confirmer la suppression</button></Modale>}
  </>;
}
