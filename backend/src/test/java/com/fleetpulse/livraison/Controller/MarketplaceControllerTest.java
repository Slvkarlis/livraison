package com.fleetpulse.livraison.Controller;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fleetpulse.livraison.Dto.*;
import com.fleetpulse.livraison.Dto.MarketplaceDto.*;
import com.fleetpulse.livraison.Dto.RemiseDto.*;
import com.fleetpulse.livraison.Dto.SuiviDto.*;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Service.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

@ExtendWith(MockitoExtension.class)
class MarketplaceControllerTest extends ControleurTestSupport {
    @Mock ZoneService zones; @Mock CatalogueService catalogue; @Mock AdresseService adresses;
    @Mock CommandeService commandes; @Mock SuiviCommandeService suivi; @Mock RemiseClientService remise;
    @InjectMocks MarketplaceController controleur; MockMvc http;
    @BeforeEach void preparer() { http=http(controleur); }
    @Test void crudZonesEtValidationDuJson() throws Exception {
        var vue=ZoneVue.from(zone(),1);
        when(zones.lister()).thenReturn(List.of(vue)); when(zones.enregistrer(isNull(),any())).thenReturn(vue);
        when(zones.enregistrer(eq(2L),any())).thenReturn(vue);
        String json="{\"nom\":\"Tunis\",\"polygone\":[{\"latitude\":36,\"longitude\":10},{\"latitude\":36,\"longitude\":11},{\"latitude\":37,\"longitude\":10}],\"fraisLivraison\":3.500}";
        http.perform(get("/api/admin/zones")).andExpect(jsonPath("$[0].nom").value("Tunis"));
        http.perform(post("/api/admin/zones").contentType("application/json").content(json)).andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(2));
        http.perform(put("/api/admin/zones/2").contentType("application/json").content(json)).andExpect(status().isOk());
        http.perform(delete("/api/admin/zones/2")).andExpect(status().isNoContent()); verify(zones).supprimer(2L);
        doThrow(MarketplaceException.absent()).when(zones).supprimer(99L);
        http.perform(delete("/api/admin/zones/99")).andExpect(status().isNotFound());
    }
    @Test void commerceEtProduitsDuPartenaireConnecte() throws Exception {
        var commerce=CommerceVue.from(partenaire()); var produit=ProduitVue.from(produit());
        when(catalogue.moi(utilisateur.getName())).thenReturn(commerce);
        when(catalogue.ouverture(eq(utilisateur.getName()),any())).thenReturn(commerce);
        when(catalogue.mesProduits(utilisateur.getName())).thenReturn(List.of(produit));
        when(catalogue.enregistrer(eq(utilisateur.getName()),isNull(),any())).thenReturn(produit);
        when(catalogue.enregistrer(eq(utilisateur.getName()),eq(6L),any())).thenReturn(produit);
        http.perform(get("/api/partenaire/commerce").principal(utilisateur)).andExpect(jsonPath("$.nomCommerce").value("Chez Amira"));
        http.perform(put("/api/partenaire/commerce").principal(utilisateur).contentType("application/json").content("{\"ouvert\":true}")).andExpect(status().isOk());
        verify(catalogue).ouverture(utilisateur.getName(),new CommerceRequest(true));
        http.perform(get("/api/partenaire/produits").principal(utilisateur)).andExpect(jsonPath("$[0].nom").value("Couscous"));
        String json="{\"nom\":\"Couscous\",\"prix\":8.000,\"disponible\":true}";
        http.perform(post("/api/partenaire/produits").principal(utilisateur).contentType("application/json").content(json)).andExpect(status().isCreated());
        http.perform(put("/api/partenaire/produits/6").principal(utilisateur).contentType("application/json").content(json)).andExpect(status().isOk());
        verify(catalogue).enregistrer(utilisateur.getName(),6L,new ProduitRequest("Couscous",new BigDecimal("8.000"),true));
    }
    @Test void adressesRespectentLeCompteConnecte() throws Exception {
        var vue=AdresseVue.from(adresse()); when(adresses.lister(utilisateur.getName())).thenReturn(List.of(vue));
        when(adresses.enregistrer(eq(utilisateur.getName()),isNull(),any())).thenReturn(vue);
        when(adresses.enregistrer(eq(utilisateur.getName()),eq(7L),any())).thenReturn(vue);
        http.perform(get("/api/adresses").principal(utilisateur)).andExpect(jsonPath("$[0].libelle").value("Maison"));
        String json="{\"libelle\":\"Maison\",\"adresse\":\"Rue de Tunis\",\"latitude\":36.81,\"longitude\":10.19}";
        http.perform(post("/api/adresses").principal(utilisateur).contentType("application/json").content(json)).andExpect(status().isCreated());
        http.perform(put("/api/adresses/7").principal(utilisateur).contentType("application/json").content(json)).andExpect(status().isOk());
        http.perform(delete("/api/adresses/7").principal(utilisateur)).andExpect(status().isNoContent()); verify(adresses).supprimer(utilisateur.getName(),7L);
    }
    @Test void recherchePartenairesExigeAdresseEtTransmetLesFiltres() throws Exception {
        when(catalogue.rechercher(utilisateur.getName(),7L,"Restaurant","Amira")).thenReturn(List.of(CommerceVue.from(partenaire())));
        when(catalogue.catalogue(utilisateur.getName(),3L,7L)).thenReturn(List.of(ProduitVue.from(produit())));
        http.perform(get("/api/partenaires").principal(utilisateur).param("adresseId","7").param("categorie","Restaurant").param("recherche","Amira"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(3));
        http.perform(get("/api/partenaires/3/produits").principal(utilisateur).param("adresseId","7")).andExpect(jsonPath("$[0].id").value(6));
        http.perform(get("/api/partenaires").principal(utilisateur)).andExpect(status().isBadRequest());
    }
    @Test void devisCommandeEtHistorique() throws Exception {
        var devis=new DevisVue(3L,"Chez Amira","Tunis",List.of(),new BigDecimal("8.000"),new BigDecimal("3.500"),new BigDecimal("11.500"),"a".repeat(64));
        when(commandes.devis(eq(utilisateur.getName()),any())).thenReturn(devis);
        when(commandes.commander(eq(utilisateur.getName()),any())).thenReturn(LivraisonResponse.from(commande(StatutLivraison.PENDING_PARTNER)));
        when(commandes.historique(utilisateur.getName(),8L)).thenReturn(List.of());
        when(commandes.annuler(eq(utilisateur.getName()),eq(8L),isNull())).thenReturn(LivraisonResponse.from(commande(StatutLivraison.ANNULEE)));
        String json="{\"partenaireId\":3,\"adresseId\":7,\"lignes\":[{\"produitId\":6,\"quantite\":1}]}";
        http.perform(post("/api/commandes/devis").principal(utilisateur).contentType("application/json").content(json)).andExpect(jsonPath("$.total").value(11.5));
        http.perform(post("/api/commandes").principal(utilisateur).contentType("application/json").content(json)).andExpect(status().isCreated()).andExpect(jsonPath("$.statut").value("PENDING_PARTNER"));
        http.perform(get("/api/commandes/8/historique").principal(utilisateur)).andExpect(content().json("[]"));
        http.perform(put("/api/commandes/8/annuler").principal(utilisateur)).andExpect(jsonPath("$.statut").value("ANNULEE"));
    }
    @Test void suiviQrEtCodeDeRemise() throws Exception {
        when(suivi.suivi(utilisateur.getName(),8L)).thenReturn(new SuiviCommandeVue(8L,StatutLivraison.RECUPEREE,"Sami",null,new Position(36.8,10.18),new Position(36.81,10.19),null,Instant.now(),null,null));
        when(remise.qr(utilisateur.getName(),8L)).thenReturn(new QrRemiseVue("QR-DYNAMIQUE",Instant.now().plusSeconds(120)));
        when(remise.renvoyerCode(utilisateur.getName(),8L)).thenReturn(new CodeRemiseEnvoye("SMS au numéro se terminant par 456",Instant.now().plusSeconds(60)));
        http.perform(get("/api/commandes/8/suivi").principal(utilisateur)).andExpect(jsonPath("$.commandeId").value(8));
        http.perform(get("/api/commandes/8/qr-remise").principal(utilisateur)).andExpect(jsonPath("$.contenuQr").value("QR-DYNAMIQUE"));
        http.perform(post("/api/commandes/8/code-remise").principal(utilisateur)).andExpect(status().isOk());
    }
}
