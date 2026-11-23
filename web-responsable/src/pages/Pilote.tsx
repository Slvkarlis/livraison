import { useState } from 'react';
import { api } from '../api';
import { Alerte, EnTete, EtatTableau, useDonnees } from '../composants/ui';

export default function Pilote() {
  const zones = useDonnees(api.zonesPilote);
  const kpi = useDonnees(api.kpiPilote);
  const [echec, setEchec] = useState<string | null>(null);
  const actives = (zones.donnees ?? []).filter(z => z.pilote).length;

  async function basculer(id: number, pilote: boolean) {
    setEchec(null);
    try {
      await api.definirPilote(id, pilote);
      await Promise.all([zones.recharger(), kpi.recharger()]);
    } catch (e) {
      setEchec((e as Error).message);
    }
  }

  return (
    <>
      <EnTete titre="Pilote" sousTitre={`${actives} zone${actives > 1 ? 's' : ''} sur 3 au pilote. Les indicateurs ne portent que sur elles.`} />
      {echec && <Alerte message={echec} />}
      <div className="carte">
        <h2>Zones du pilote</h2>
        <EtatTableau chargement={zones.chargement} erreur={zones.erreur} vide={!zones.donnees?.length} messageVide="Aucune zone." onReessayer={() => void zones.recharger()} />
        {!!zones.donnees?.length && (
          <table>
            <thead><tr><th>Zone</th><th>Au pilote</th></tr></thead>
            <tbody>
              {zones.donnees.map(z => (
                <tr key={z.id}>
                  <td>{z.nom}</td>
                  <td>
                    <button className={z.pilote ? 'bouton' : 'bouton secondaire'} onClick={() => void basculer(z.id, !z.pilote)}>
                      {z.pilote ? 'Retirer du pilote' : 'Ajouter au pilote'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="carte">
        <h2>Indicateurs · 30 derniers jours</h2>
        <EtatTableau chargement={kpi.chargement} erreur={kpi.erreur} vide={!kpi.donnees?.length} messageVide="Aucune zone pilote : ajoutez-en une pour voir ses indicateurs." onReessayer={() => void kpi.recharger()} />
        {!!kpi.donnees?.length && (
          <div className="bi-grille">
            {kpi.donnees.map(k => (
              <article key={k.zone} className="bi-indicateur">
                <h2>{k.zone}</h2>
                <strong>{k.livrees}/{k.commandes}</strong>
                <p>livrées · {k.echecs} échecs · {k.expirees} expirées</p>
                <p>Délai moyen {k.delaiMoyenMinutes ?? '—'} min · respect des ETA {k.respectEtaPct ?? '—'} %</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
