package com.msoa.catalog.config;

import com.msoa.catalog.controller.ProductController;
import com.msoa.catalog.model.Product;
import com.msoa.catalog.service.ProductService;
import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.PlainJWT;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * No server, datasource or SQLite is loaded. Run with an isolated ephemeral
 * Base64 key supplied to BOTH CATALOG_SECURITY_TEST_SECRET and MSOA_JWT_SECRET.
 * Never supply the production key: the first variable is an explicit test opt-in.
 */
class SecurityConfigTest {

    private static AnnotationConfigWebApplicationContext context;
    private static MockMvc mvc;
    private static ProductService service;
    private static JwtDecoder decoder;
    private static byte[] testKey;
    private static final Product PRODUCT = new Product(
            42L, "Test product", "Test category", new BigDecimal("12.50"), "", "");
    private static final String BODY = """
            {"name":"Test product","category":"Test category","price":12.50,
             "image":"","description":""}
            """;

    @BeforeAll
    static void configureIsolatedSecurityContext() {
        String encodedKey = System.getenv("CATALOG_SECURITY_TEST_SECRET");
        assertNotNull(encodedKey, "Provide an ephemeral isolated test key, not a production key");
        assertTrue(encodedKey.equals(System.getenv("MSOA_JWT_SECRET")),
                "The isolated test key must be passed to the production decoder");
        testKey = Base64.getDecoder().decode(encodedKey);

        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.register(SecurityConfig.class, JwtConfig.class, IsolatedWebConfiguration.class);
        context.refresh();
        decoder = context.getBean(JwtDecoder.class);
        service = context.getBean(ProductService.class);
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(context.getBean(FilterChainProxy.class))
                .build();
    }

    @AfterAll
    static void closeContext() {
        if (context != null) context.close();
    }

    @BeforeEach
    void prepareBusinessStub() {
        reset(service);
        when(service.getAllProducts(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(PRODUCT));
        when(service.getProductById(42L)).thenReturn(PRODUCT);
        when(service.createProduct(any())).thenReturn(PRODUCT);
        when(service.updateProduct(eq(42L), any())).thenReturn(PRODUCT);
    }

    @ParameterizedTest
    @ValueSource(strings = {"ADMIN", "admin", "Admin", "aDmIn"})
    void adminCaseVariantsGrantExactlyTheAdminRole(String role) {
        JwtAuthenticationConverter converter =
                new SecurityConfig().jwtAuthenticationConverter("role");
        var authentication = converter.convert(jwtWithRole(role));
        List<String> roles = authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .filter(authority -> authority.startsWith("ROLE_"))
                .toList();
        assertEquals(List.of("ROLE_ADMIN"), roles);
        // Spring Security can additionally supply its technical FACTOR_BEARER authority.
        assertTrue(authentication.getAuthorities().stream().allMatch(authority ->
                authority.getAuthority().equals("ROLE_ADMIN")
                        || authority.getAuthority().equals("FACTOR_BEARER")));
    }

    static Stream<Object> nonAdminClaims() {
        return Stream.of("USER", "user", "ROLE_ADMIN", "ADMIN USER", " ADMIN ",
                "", 123, true, List.of("ADMIN"), Map.of("role", "ADMIN"));
    }

    @ParameterizedTest
    @MethodSource("nonAdminClaims")
    void otherValuesAndNonTextClaimsDoNotGrantAdmin(Object role) {
        var authentication = new SecurityConfig().jwtAuthenticationConverter("role")
                .convert(jwtWithRole(role));
        assertFalse(authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().startsWith("ROLE_")));
    }

    @Test
    void missingClaimAndAlternativeRoleArraysDoNotGrantAdmin() {
        Jwt jwt = Jwt.withTokenValue("converter-only")
                .header("alg", "HS256").subject("test-user")
                .claim("roles", List.of("ADMIN"))
                .claim("authorities", List.of("ROLE_ADMIN")).build();
        var authentication = new SecurityConfig().jwtAuthenticationConverter("role").convert(jwt);
        assertFalse(authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().startsWith("ROLE_")));
    }

    @Test
    void configuredClaimNameIsStillRespected() {
        Jwt jwt = Jwt.withTokenValue("converter-only").header("alg", "HS256")
                .subject("test-user").claim("permission", "aDmIn").claim("role", "USER").build();
        var authentication = new SecurityConfig().jwtAuthenticationConverter("permission").convert(jwt);
        assertTrue(authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN")));
    }

    @Test
    void productReadsRemainPublic() throws Exception {
        mvc.perform(get("/products")).andExpect(status().isOk());
        mvc.perform(get("/products/42")).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"POST", "PUT", "DELETE"})
    void writesWithoutBearerStillReturn401(String method) throws Exception {
        mvc.perform(writeRequest(method)).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @ParameterizedTest
    @ValueSource(strings = {"USER", "user"})
    void userTokensCannotUseAnyWriteRoute(String role) throws Exception {
        String token = sign(role, testKey, JWSAlgorithm.HS256, Instant.now().plusSeconds(300));
        for (String method : List.of("POST", "PUT", "DELETE")) {
            mvc.perform(writeRequest(method).header("Authorization", "Bearer " + token))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(service);
    }

    @ParameterizedTest
    @MethodSource("nonAdminClaims")
    void signedNonAdminClaimsAreDeniedBeforeBusinessCode(Object role) throws Exception {
        String token = sign(role, testKey, JWSAlgorithm.HS256, Instant.now().plusSeconds(300));
        mvc.perform(writeRequest("POST").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    void signedTokenWithoutRoleIsDenied() throws Exception {
        String token = sign(null, testKey, JWSAlgorithm.HS256, Instant.now().plusSeconds(300));
        mvc.perform(writeRequest("POST").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @ParameterizedTest
    @ValueSource(strings = {"ADMIN", "admin", "Admin", "aDmIn"})
    void validAdminVariantsKeepWriteRoutesAndBusinessStatuses(String role) throws Exception {
        String token = sign(role, testKey, JWSAlgorithm.HS256, Instant.now().plusSeconds(300));
        mvc.perform(writeRequest("POST").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated());
        mvc.perform(writeRequest("PUT").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        mvc.perform(writeRequest("DELETE").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        verify(service).createProduct(any());
        verify(service).updateProduct(eq(42L), any());
        verify(service).deleteProduct(42L);
    }

    @Test
    void expiredWrongKeyMalformedUnsignedAndOtherAlgorithmsAreRejected() throws Exception {
        byte[] otherKey = new byte[64];
        new SecureRandom().nextBytes(otherKey);
        JWTClaimsSet unsignedClaims = claims("ADMIN", Instant.now().plusSeconds(300));
        List<String> rejected = List.of(
                sign("ADMIN", testKey, JWSAlgorithm.HS256, Instant.now().minusSeconds(300)),
                sign("ADMIN", otherKey, JWSAlgorithm.HS256, Instant.now().plusSeconds(300)),
                sign("ADMIN", testKey, JWSAlgorithm.HS384, Instant.now().plusSeconds(300)),
                sign("ADMIN", testKey, JWSAlgorithm.HS512, Instant.now().plusSeconds(300)),
                sign("ADMIN", testKey, JWSAlgorithm.HS256, null),
                new PlainJWT(unsignedClaims).serialize(),
                "not-a-jwt");
        for (String token : rejected) {
            assertThrows(JwtException.class, () -> decoder.decode(token));
            for (String method : List.of("POST", "PUT", "DELETE")) {
                mvc.perform(writeRequest(method).header("Authorization", "Bearer " + token))
                        .andExpect(status().isUnauthorized());
            }
        }
        verifyNoInteractions(service);
    }

    @Test
    void unlistedRoutesAndMethodsRemainDeniedEvenForAdmin() throws Exception {
        String token = sign("admin", testKey, JWSAlgorithm.HS256, Instant.now().plusSeconds(300));
        mvc.perform(patch("/products/42").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        mvc.perform(get("/unlisted").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    private static Jwt jwtWithRole(Object role) {
        return Jwt.withTokenValue("converter-only").header("alg", "HS256")
                .subject("test-user").claim("role", role).build();
    }

    private static MockHttpServletRequestBuilder writeRequest(String method) {
        String path = method.equals("POST") ? "/products" : "/products/42";
        return request(HttpMethod.valueOf(method), path)
                .contentType("application/json").content(BODY);
    }

    private static JWTClaimsSet claims(Object role, Instant expiration) {
        JWTClaimsSet.Builder builder = new JWTClaimsSet.Builder()
                .subject("test-user").issueTime(Date.from(Instant.now().minusSeconds(3600)));
        if (expiration != null) builder.expirationTime(Date.from(expiration));
        if (role != null) builder.claim("role", role);
        return builder.build();
    }

    private static String sign(Object role, byte[] key, JWSAlgorithm algorithm,
                               Instant expiration) throws Exception {
        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(algorithm).type(JOSEObjectType.JWT).build(),
                claims(role, expiration));
        jwt.sign(new MACSigner(key));
        return jwt.serialize();
    }

    @Configuration(proxyBeanMethods = false)
    @EnableWebSecurity
    @EnableWebMvc
    static class IsolatedWebConfiguration {
        @Bean
        ProductService productService() {
            return mock(ProductService.class);
        }

        @Bean
        ProductController productController(ProductService productService) {
            return new ProductController(productService);
        }
    }
}
