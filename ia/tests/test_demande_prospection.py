import unittest

from fleetpulse_ia.demande import ModeleDemande, simuler as simuler_demande, wape
from fleetpulse_ia.prospection import ModeleProspection, score_regle, simuler as simuler_prospects


class DemandeTest(unittest.TestCase):
    def test_sans_historique_moyenne_zone_jour_heure(self):
        m = ModeleDemande()
        m.entrainer([{"zoneId": 1, "date": "2026-01-05", "heure": 12, "jourSemaine": 1, "commandes": 4},
                     {"zoneId": 1, "date": "2026-01-12", "heure": 12, "jourSemaine": 1, "commandes": 6}])
        self.assertEqual((5.0, "moyenne-zone-jour-heure"), m.predire(1, 1, 12))
        self.assertEqual("moyenne-zone", m.predire(1, 3, 9)[1])
        self.assertEqual(0.0, m.predire(99, 1, 12)[0], "zone inconnue : 0 commande, jamais negatif")

    def test_historique_simule_entraine_et_evalue_sans_fuite(self):
        m = ModeleDemande()
        metriques = m.entrainer(simuler_demande())
        self.assertEqual("gbr", m.version)
        self.assertIn("mae", metriques)
        self.assertIsNotNone(metriques["wape"])
        midi, nuit = m.predire(1, 2, 12)[0], m.predire(1, 2, 3)[0]
        self.assertGreater(midi, nuit, "un creneau de pointe prevoit plus de commandes qu'une nuit")
        self.assertGreaterEqual(m.predire(1, 6, 20)[0], 0)

    def test_wape(self):
        self.assertEqual(0.2, wape([10, 10], [12, 8]))  # (2 + 2) / 20
        self.assertIsNone(wape([0, 0], [1, 1]), "pas de division par zero")


class ProspectionTest(unittest.TestCase):
    def test_regle_lisible_et_bornee(self):
        dense = {"clientsZone": 80, "couvertureZonePct": 0, "concurrentsProches": 0, "distanceClientsKm": 0}
        concurrentiel = {"clientsZone": 5, "couvertureZonePct": 80, "concurrentsProches": 5, "distanceClientsKm": 5}
        self.assertGreater(score_regle(dense), score_regle(concurrentiel))
        self.assertTrue(0 <= score_regle(concurrentiel) <= 100)
        self.assertTrue(0 <= score_regle(dense) <= 100)

    def test_modele_entraine_sur_simulation(self):
        m = ModeleProspection()
        metriques = m.entrainer(simuler_prospects())
        self.assertEqual("logistique", m.version)
        self.assertGreater(metriques["auc"], 0.6, "le signal simule doit etre apprenable")
        score, modele = m.scorer({"categorie": "RESTAURANT", "clientsZone": 70, "couvertureZonePct": 10,
                                  "concurrentsProches": 0, "distanceClientsKm": 0.5})
        self.assertEqual("logistique", modele)
        self.assertTrue(0 <= score <= 100)

    def test_categorie_inconnue_et_sans_historique(self):
        m = ModeleProspection()
        self.assertEqual("regle", m.scorer({"categorie": "AUTRE_TRUC"})[1])
        self.assertEqual({}, m.entrainer([{"categorie": "AUTRE", "converti": True}]), "trop peu de lignes : pas de modele")


if __name__ == "__main__":
    unittest.main()
