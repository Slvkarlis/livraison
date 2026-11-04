package com.fleetpulse.livraison.Config;

import com.fleetpulse.livraison.Security.AuthentificationStomp;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Temps reel (US-2B1) : STOMP sur WebSocket a /ws, sans SockJS.
 * Chaque utilisateur recoit les changements de ses commandes sur /user/queue/commandes (voir DiffusionTempsReel).
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    @Autowired
    private AuthentificationStomp authentification;
    // Memes origines que le CORS de l'API (apercu web) ; les applications natives n'envoient pas d'en-tete Origin.
    @Value("${app.cors.origines:}")
    private List<String> origines;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOrigins(origines.stream().map(String::trim).filter(o -> !o.isEmpty()).toArray(String[]::new));
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/queue");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authentification);
    }
}
