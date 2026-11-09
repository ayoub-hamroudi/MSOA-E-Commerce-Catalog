# Sécurité — JWT HS256 et autorisation Catalog

Source de vérité : SecurityConfig.java et JwtConfig.java, audités le 7 novembre 2026. Catalog vérifie les access tokens d'Auth ; il ne crée pas de compte ou de token de connexion.

## Routes et chaîne Security

| Route | Autorisation |
|---|---|
| GET /products, filtres compris | Public |
| GET /products/{id} | Public |
| POST /products | hasRole("ADMIN") |
| PUT /products/{id} | hasRole("ADMIN") |
| DELETE /products/{id} | hasRole("ADMIN") |
| Autres routes/méthodes | denyAll |

La chaîne est STATELESS, sans formulaire, HTTP Basic, logout Security ou cache de requête. Pas de session d'authentification serveur. CSRF est désactivé pour cette API Bearer utilisant l'en-tête Authorization, sans authentification par cookie.

Les dispatchs internes ERROR sont autorisés afin de préserver les réponses métier ; cela ne rend pas /error directement public. Aucun endpoint dédié /products/search : voir [API.md](API.md).

## CORS unique

CORS est centralisé dans le bean CorsConfigurationSource de SecurityConfig et appliqué avant l'authentification.

- Origines exactes : **http://localhost:5173** et **http://localhost:5174**.
- Méthodes : GET, POST, PUT, DELETE, OPTIONS.
- En-têtes : Authorization, Content-Type, Accept.
- allowCredentials : false ; aucun joker d'origine.
- Chemins CORS : /products et /products/*.
- Pré-vérifications valides autorisées sans JWT.

**ProductController ne porte plus d'annotation CORS.** Ne pas réintroduire une configuration contradictoire. CORS ne remplace jamais la validation JWT ou l'autorisation ADMIN.

## Secret et algorithme

MSOA_JWT_SECRET est lu directement dans l'environnement du processus Java. Il doit contenir du **Base64 standard**, sans espace ou retour à la ligne, décodant au moins **32 octets cryptographiquement aléatoires**.

La clé utilisée par Auth doit être identique octet par octet après décodage. Une chaîne brute, hexadécimale, Base64URL ou l'utilisation des caractères Base64 comme octets HMAC peut être incompatible. Ne pas partager une clé réelle dans Git ou une conversation.

Absence, valeur vide, Base64 mal formé ou clé trop courte : le démarrage échoue avec un message explicite sans afficher le secret. Aucun secret codé en dur ou généré au démarrage. La longueur est contrôlée, pas l'entropie réelle.

Provisionnement PowerShell depuis la racine du service :

```powershell
$catalogSecretInput = Read-Host 'Cle partagee Auth/Catalog en Base64' -AsSecureString
$env:MSOA_JWT_SECRET = [System.Net.NetworkCredential]::new('', $catalogSecretInput).Password
.\mvnw.cmd spring-boot:run
```

Ne pas afficher la variable. Après arrêt, la retirer du terminal si nécessaire :

```powershell
Remove-Item Env:MSOA_JWT_SECRET
Remove-Variable catalogSecretInput
```

NimbusJwtDecoder utilise SecretKeySpec(HmacSHA256) et **MacAlgorithm.HS256 exclusivement**. none, RS256, HS384 et HS512 ne sont pas acceptés ; pas de choix automatique depuis le header. Pas de découverte OIDC/JWKS ou d'appel réseau à Auth.

## Claims et paramètres

| Claim / variable | Traitement |
|---|---|
| exp | Obligatoire et vérifié |
| nbf | Facultatif, vérifié s'il est présent |
| sub | Nom du principal par défaut ; absence/non-vacuité non exigée explicitement |
| iat | Pas de validateur dédié de date future/ancienneté ; cohérence exp > iat assurée par le framework lorsque les deux dates sont représentées |
| MSOA_JWT_ROLE_CLAIM | Nom du claim de rôle ; role par défaut ; blanc refusé au démarrage |
| MSOA_JWT_ISSUER | Vide par défaut ; si renseignée, iss doit correspondre exactement |
| MSOA_JWT_AUDIENCE | Vide par défaut ; si renseignée, aud doit contenir cette audience |

JwtValidators.createDefault() contrôle notamment exp/nbf avec une tolérance d'horloge de **60 secondes**. Un validateur supplémentaire impose exp. Un token expiré au-delà de la tolérance ou utilisé trop tôt est refusé.

**iss/aud ne sont pas validés lorsque leurs variables ne sont pas renseignées.** Aucune valeur Auth n'est inventée ; leur activation dans un environnement réel doit être confirmée. Les validateurs standards utilisent le type JWT standard ou absent ; ne pas supposer compatible un access token typé at+jwt sans vérifier le contrat.

## Rôle ADMIN, insensible à la casse

Après validation du JWT, le convertisseur exige que le claim configuré soit un **String** puis applique "ADMIN".equalsIgnoreCase(role).

| Valeur du claim configuré | Rôle attribué |
|---|---|
| ADMIN, admin, Admin, aDmIn | ROLE_ADMIN |
| USER, user, ROLE_ADMIN | Aucun rôle ADMIN |
| " ADMIN ", "ADMIN USER" | Aucun rôle ADMIN |
| Claim absent, tableau, nombre, booléen, objet | Aucun rôle ADMIN |

Le convertisseur n'enlève pas les espaces. Il ne prend pas en charge les tableaux roles/authorities et ne transforme pas scope/scp en rôles. MSOA_JWT_ROLE_CLAIM change le nom du claim, pas son type. Aucun USER ou ADMIN par défaut.

hasRole("ADMIN") attend ROLE_ADMIN, préfixe ajouté côté Catalog. Spring Security peut aussi ajouter son autorité technique FACTOR_BEARER ; ce n'est pas un rôle métier ni un droit ADMIN supplémentaire.

Fragment de payload fictif illustrant uniquement le rôle :

```json
{
  "sub": "user123",
  "role": "admin"
}
```

Ce fragment n'est pas un JWT et n'est pas suffisant seul : un token réel nécessite signature correcte, exp valide et iss/aud conformes s'ils sont configurés. La convention de rôle doit encore être confirmée avec Auth.

## Réponses HTTP

- Écriture sans token : **401**.
- JWT invalide, mal signé, non signé, expiré hors tolérance ou sans exp : **401**.
- JWT valide sans ADMIN reconnu : **403**.
- ADMIN valide : règles métier inchangées, POST 201, PUT 200, DELETE 204, validation 400, produit absent 404.
- GET anonyme : réponse métier habituelle.
- Bearer fourni mais invalide, même sur GET public : peut produire **401**.

Les erreurs utilisent les mécanismes Bearer Spring, sans redirection Login ou enveloppe JSON métier uniforme. Ne pas injecter un token mock dans une lecture publique.

## Validation et limites

La suite complète de cette finalisation compte **40 tests réussis**, dont **39 tests SecurityConfigTest** avec le vrai décodeur et la vraie chaîne Security, un ProductService simulé et des tokens de test signés avec une clé éphémère. Les quatre casses ADMIN, refus de USER/non-textuels, absence de token, JWT expirés/mal signés/non signés, autres algorithmes et règles d'accès sont couverts.

Ces tests isolés ne valident pas la compatibilité avec Auth réel, la persistance métier ou toutes les erreurs DTO. Aucun POST/PUT/DELETE n'est envoyé au serveur réel. Voir [TESTING.md](TESTING.md).

Pas de rotation automatique des clés, révocation JWT ou synchronisation des comptes. Avec HS256, un détenteur de la clé peut signer : limiter son partage aux composants de confiance. Coordonner provisionnement, iss/aud, rôle, dates, type de token et cycle de session avec Auth avant intégration.
