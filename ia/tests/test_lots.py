import unittest

from fleetpulse_ia.lots import Commande, compatibles, regrouper

COMMERCE, VOISIN, LOIN = (36.800, 10.180), (36.802, 10.181), (36.900, 10.300)
CLIENT = (36.815, 10.185)


def cmd(i, zone=2, commerce=COMMERCE, prete=0):
    return Commande(i, zone, commerce, CLIENT, prete)


class TestLots(unittest.TestCase):
    def test_collectes_proches_regroupees(self):
        lots = regrouper([cmd(1), cmd(2, commerce=VOISIN, prete=60), cmd(3, commerce=LOIN, prete=30)], {}, 1.5, 20, 35 * 60)
        self.assertEqual([[c.id for c in contenu] for contenu, _ in lots], [[1, 2], [3]])
        self.assertEqual(lots[0][1].code()[:2], ["C:1", "C:2"])

    def test_trois_commandes_au_plus(self):
        lots = regrouper([cmd(i) for i in range(1, 5)], {}, 1.5, 20, 35 * 60)
        self.assertEqual(sorted(len(contenu) for contenu, _ in lots), [1, 3])

    def test_zones_adjacentes_et_ecart_de_preparation(self):
        self.assertFalse(compatibles(cmd(1), cmd(2, zone=5), {}, 1.5))
        self.assertTrue(compatibles(cmd(1), cmd(2, zone=5), {2: {5}}, 1.5))
        self.assertFalse(compatibles(cmd(1), cmd(2, prete=601), {}, 1.5))

    def test_recherche_globale_par_economies(self):
        # 2 et 3 ont le meme commerce et le meme client : leur fusion rapporte le plus, meme si 1 est plus ancienne
        loin_client = (36.84, 10.20)
        lots = regrouper([Commande(1, 2, COMMERCE, loin_client, 300), cmd(2, commerce=VOISIN), cmd(3, commerce=VOISIN)],
                         {}, 1.5, 20, 12 * 60)
        groupes = sorted(sorted(c.id for c in contenu) for contenu, _ in lots)
        self.assertIn([2, 3], groupes)

    def test_duree_a_bord_trop_courte_aucun_regroupement(self):
        lots = regrouper([cmd(1), cmd(2, commerce=VOISIN)], {}, 1.5, 20, 4 * 60)
        self.assertEqual(len(lots), 2)


if __name__ == "__main__":
    unittest.main()
