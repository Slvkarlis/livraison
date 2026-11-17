import os
import tempfile
import unittest

from fleetpulse_ia.eta import MIN_ECHANTILLONS, Caracteristiques, ModeleEta, regle_trajet_min, simuler


class TestEta(unittest.TestCase):
    def test_regles_sans_entrainement(self):
        m = ModeleEta()
        c = Caracteristiques(3, 10, 1.4, 20, 12, 2)
        preparation, trajet, version = m.predire(c)
        self.assertEqual((preparation, version), (10, "regles"))
        self.assertAlmostEqual(trajet, regle_trajet_min(c), places=2)

    def test_apprentissage_sur_historique_simule(self):
        donnees = simuler(800, graine=1)
        m = ModeleEta()
        mae = m.entrainer(donnees[:600])
        self.assertEqual(m.version, "gbr")
        # Sur des commandes jamais vues, le modele bat la regle « on croit l'annonce »
        test = donnees[600:]
        erreur_modele = sum(abs(m.predire(_c(e))[0] - e["preparationReelleMin"]) for e in test) / len(test)
        erreur_regle = sum(abs(e["preparationAnnonceeMin"] - e["preparationReelleMin"]) for e in test) / len(test)
        self.assertLess(erreur_modele, erreur_regle)
        erreur_trajet = sum(abs(m.predire(_c(e))[1] - e["trajetReelMin"]) for e in test) / len(test)
        erreur_trajet_regle = sum(abs(regle_trajet_min(_c(e)) - e["trajetReelMin"]) for e in test) / len(test)
        self.assertLess(erreur_trajet, erreur_trajet_regle)
        self.assertIn("preparation", mae)

    def test_trop_peu_de_donnees_reste_aux_regles(self):
        m = ModeleEta()
        m.entrainer(simuler(MIN_ECHANTILLONS - 1))
        self.assertEqual(m.version, "regles")

    def test_sauvegarde_et_rechargement(self):
        m = ModeleEta()
        m.entrainer(simuler(200))
        with tempfile.TemporaryDirectory() as dossier:
            chemin = os.path.join(dossier, "m.pkl")
            m.sauver(chemin)
            c = Caracteristiques(3, 15, 2.0, 20, 13, 5)
            self.assertEqual(ModeleEta.charger(chemin).predire(c), m.predire(c))


def _c(e):
    return Caracteristiques(e["partenaireId"], e["preparationAnnonceeMin"], e["distanceKm"], e["vitesseZoneKmh"], e["heure"],
                            e["jourSemaine"], e["tailleLot"])


if __name__ == "__main__":
    unittest.main()
