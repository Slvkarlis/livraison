import unittest

try:
    from fastapi.testclient import TestClient
    from fleetpulse_ia.app import app
except ImportError:   # FastAPI non installe : seule la logique metier est testee
    app = None


@unittest.skipIf(app is None, "fastapi non installe (pip install -r requirements.txt)")
class TestApi(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_sante_et_eta(self):
        self.assertEqual(self.client.get("/sante").json()["statut"], "ok")
        r = self.client.post("/v1/eta", json={"partenaireId": 3, "preparationAnnonceeMin": 10, "distanceKm": 1.8,
                                              "vitesseZoneKmh": 20, "heure": 12, "jourSemaine": 2, "tailleLot": 1})
        self.assertEqual(r.status_code, 200)
        self.assertGreater(r.json()["preparationMin"], 0)

    def test_contrat_des_lots(self):
        r = self.client.post("/v1/lots", json={"commandes": [
            {"id": 1, "zoneId": 2, "commerce": {"latitude": 36.8, "longitude": 10.18}, "client": {"latitude": 36.815, "longitude": 10.185}},
            {"id": 2, "zoneId": 2, "commerce": {"latitude": 36.802, "longitude": 10.181}, "client": {"latitude": 36.815, "longitude": 10.185}}],
            "voisines": {"2": []}, "rayonKm": 1.5, "vitesseKmh": 20, "aBordMaxMinutes": 35})
        self.assertEqual(r.json()["lots"][0]["commandes"], [1, 2])

    def test_validation(self):
        self.assertEqual(self.client.post("/v1/eta", json={"preparationAnnonceeMin": -1}).status_code, 422)


if __name__ == "__main__":
    unittest.main()
