package com.msoa.catalog.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import javax.crypto.spec.SecretKeySpec;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Objects;

@Configuration(proxyBeanMethods = false)
public class JwtConfig {

    @Bean
    public JwtDecoder jwtDecoder(
            @Value("${MSOA_JWT_ISSUER:}") String issuer,
            @Value("${MSOA_JWT_AUDIENCE:}") String audience) {
        String encodedSecret = System.getenv("MSOA_JWT_SECRET");
        if (encodedSecret == null || encodedSecret.isBlank()) {
            throw new IllegalStateException(
                    "MSOA_JWT_SECRET is required: standard Base64 of at least 32 random bytes");
        }

        byte[] secret;
        try {
            secret = Base64.getDecoder().decode(encodedSecret);
        } catch (IllegalArgumentException exception) {
            // Do not include the supplied value or the decoder exception in the message.
            throw new IllegalStateException("MSOA_JWT_SECRET must be valid standard Base64");
        }
        if (secret.length < 32) {
            throw new IllegalStateException(
                    "MSOA_JWT_SECRET must decode to at least 32 cryptographically random bytes");
        }

        NimbusJwtDecoder decoder = NimbusJwtDecoder
                .withSecretKey(new SecretKeySpec(secret, "HmacSHA256"))
                .macAlgorithm(MacAlgorithm.HS256)
                .build();

        List<OAuth2TokenValidator<Jwt>> validators = new ArrayList<>();
        // Includes expiration/not-before validation and the standard clock tolerance.
        validators.add(JwtValidators.createDefault());
        // Require exp as well: a token without an expiration is not accepted.
        validators.add(new JwtClaimValidator<Instant>("exp", Objects::nonNull));
        if (!issuer.isBlank()) {
            validators.add(new JwtIssuerValidator(issuer));
        }
        if (!audience.isBlank()) {
            validators.add(new JwtClaimValidator<List<String>>("aud",
                    values -> values != null && values.contains(audience)));
        }
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(validators));
        return decoder;
    }
}
