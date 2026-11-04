package com.fleetpulse.livraison.Security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

/**
 * Canal temps reel : le JWT est verifie au CONNECT STOMP (en-tete Authorization), comme pour l'API REST.
 * Le client ne peut s'abonner qu'a ses propres files (/user/queue/...) et n'envoie aucun message.
 */
@Component
public class AuthentificationStomp implements ChannelInterceptor {
    static final String PREFIXE_AUTORISE = "/user/queue/";
    @Autowired
    private JwtService jwtService;
    @Autowired
    private UtilisateurDetailsService detailsService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) return message;
        switch (accessor.getCommand()) {
            // STOMP est l'alias STOMP 1.2 de CONNECT : meme authentification
            case CONNECT, STOMP -> accessor.setUser(authentifier(accessor.getFirstNativeHeader("Authorization")));
            case SUBSCRIBE -> {
                String destination = accessor.getDestination();
                if (destination == null || !destination.startsWith(PREFIXE_AUTORISE))
                    throw new AccessDeniedException("Abonnement refusé : " + destination);
            }
            case SEND -> throw new AccessDeniedException("Envoi de messages non autorisé.");
            default -> { }
        }
        return message;
    }

    private UsernamePasswordAuthenticationToken authentifier(String header) {
        if (header == null || !header.startsWith("Bearer ")) throw new AccessDeniedException("Jeton manquant.");
        String token = header.substring(7);
        try {
            UserDetails user = detailsService.loadUserByUsername(jwtService.extractEmail(token));
            // Meme regle que JwtAuthenticationFilter : un compte suspendu perd l'acces immediatement
            if (user.isEnabled() && jwtService.isValid(token, user.getUsername()))
                return new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
        } catch (RuntimeException ignored) {
            // Jeton invalide ou compte introuvable : refus ci-dessous
        }
        throw new AccessDeniedException("Jeton invalide ou expiré.");
    }
}
