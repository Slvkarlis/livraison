import unittest

from fleetpulse_ia.itineraire import COLLECTE, LIVRAISON, Course, optimiser

COMMERCE_A, COMMERCE_B = (36.800, 10.180), (36.801, 10.181)
CLIENT_A, CLIENT_B = (36.810, 10.180), (36.820, 10.180)


class TestItineraire(unittest.TestCase):
    def test_memes_resultats_que_java(self):
        # Valeurs identiques a ItineraireTest.java : meme ordre, meme duree
        t = optimiser([Course(1, COMMERCE_A, CLIENT_A), Course(2, COMMERCE_B, CLIENT_B)], 20, 35 * 60)
        self.assertEqual(t.code(), ["C:1", "C:2", "L:1", "L:2"])
        self.assertEqual(t.duree_s, 1008)
        self.assertLess(t.livraison_s(1), t.livraison_s(2))

    def test_duree_a_bord_depassee(self):
        self.assertIsNone(optimiser([Course(1, COMMERCE_A, CLIENT_A), Course(2, COMMERCE_B, CLIENT_B)], 20, 5 * 60))

    def test_colis_deja_a_bord_et_depart_coursier(self):
        t = optimiser([Course(1, COMMERCE_A, CLIENT_A, a_bord=True), Course(2, COMMERCE_B, CLIENT_B)], 20, 35 * 60,
                      depart=(36.805, 10.180))
        self.assertEqual(len(t.etapes), 3)
        self.assertEqual(t.duree_s, 961)

    def test_precedence_respectee_meme_pour_un_grand_lot(self):
        courses = [Course(i, (36.80 + i / 1000, 10.18), (36.81 + i / 500, 10.18)) for i in range(1, 7)]
        t = optimiser(courses, 20, None)
        position = {(typ, i): k for k, (typ, i, _, _) in enumerate(t.etapes)}
        for i in range(1, 7):
            self.assertLess(position[(COLLECTE, i)], position[(LIVRAISON, i)])

    def test_entrees_vides(self):
        self.assertIsNone(optimiser([], 20, None))
        self.assertIsNone(optimiser([Course(1, COMMERCE_A, CLIENT_A)], 0, None))


if __name__ == "__main__":
    unittest.main()
