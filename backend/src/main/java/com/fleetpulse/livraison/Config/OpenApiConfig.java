package com.fleetpulse.livraison.Config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import java.util.List;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    OpenAPI livraisonOpenApi() {
        return new OpenAPI()
                .info(new Info().title("FleetPulse - API Livraison").version("sprint-3"))
                .components(new Components().addSecuritySchemes("bearerAuth", new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
    }

    @Bean
    OpenApiCustomizer authentificationPublique() {
        return api -> api.getPaths().forEach((path, item) -> {
            if (path.startsWith("/api/auth/")) {
                item.readOperations().forEach(operation -> operation.setSecurity(List.of()));
            }
        });
    }
}
