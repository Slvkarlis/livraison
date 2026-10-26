package com.fleetpulse.livraison.Security;

import com.fleetpulse.livraison.Dto.ProfilResponse;
import com.fleetpulse.livraison.Dto.VehiculeResponse;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
    @Value("${app.jwt.secret}")
    private String secret;
    @Value("${app.jwt.expiration-ms}")
    private long expirationMs;

    private SecretKey signingKey;

    @PostConstruct
    void init() {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /** Le profil de l'utilisateur est place dans l'en-tete du jeton (parametre "profil"). */
    public String generateToken(String email, String role, ProfilResponse profil) {
        Date now = new Date();
        return Jwts.builder()
                .header().add("profil", toMap(profil)).and()
                .subject(email)
                .claim("role", role)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMs))
                .signWith(signingKey)
                .compact();
    }

    public String extractEmail(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public boolean isValid(String token, String email) {
        return email.equals(extractEmail(token)) && !isExpired(token);
    }

    private boolean isExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    private <T> T extractClaim(String token, Function<Claims, T> resolver) {
        return resolver.apply(Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token).getPayload());
    }

    private static Map<String, Object> toMap(ProfilResponse profil) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", profil.id());
        map.put("nom", profil.nom());
        map.put("prenom", profil.prenom());
        map.put("email", profil.email());
        map.put("telephone", profil.telephone());
        map.put("role", profil.role() == null ? null : profil.role().name());
        map.put("sousRole", profil.sousRole() == null ? null : profil.sousRole().name());
        map.put("statut", profil.statut() == null ? null : profil.statut().name());
        VehiculeResponse vehicule = profil.vehicule();
        if (vehicule != null) {
            Map<String, Object> vehiculeMap = new LinkedHashMap<>();
            vehiculeMap.put("id", vehicule.id());
            vehiculeMap.put("immatriculation", vehicule.immatriculation());
            vehiculeMap.put("type", vehicule.type());
            vehiculeMap.put("capaciteKg", vehicule.capaciteKg());
            vehiculeMap.put("consommationLitres100Km", vehicule.consommationLitres100Km());
            vehiculeMap.put("actif", vehicule.actif());
            map.put("vehicule", vehiculeMap);
        } else {
            map.put("vehicule", null);
        }
        return map;
    }
}
