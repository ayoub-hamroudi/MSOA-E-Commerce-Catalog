# API REST — Catalog Service

Base locale : **http://localhost:8082**. Pas de préfixe /api. Source de vérité : ProductController, ProductService, DTO et ProductRepository, audités le 7 novembre 2026.

Les deux GET étaient exigés par le contrat initial du professeur ; les écritures sont des extensions protégées. Aucun exemple de mutation ci-dessous n'est exécuté pendant la documentation.

## Routes exposées

| Méthode | Route | Accès | Succès |
|---|---|---|---|
| GET | /products | Public | 200, tableau |
| GET | /products/{id} | Public | 200, produit |
| POST | /products | JWT valide ADMIN | 201, produit |
| PUT | /products/{id} | JWT valide ADMIN | 200, produit |
| DELETE | /products/{id} | JWT valide ADMIN | 204, corps vide |

### GET /products/search : écart de contrat

**Aucun mapping dédié /products/search n'existe actuellement.** Ne pas utiliser cette URL comme API de recherche. Elle est capturée par /products/{id}, et la conversion de search en Long échoue normalement en 400 pour une requête anonyme valide par ailleurs. La recherche réelle est **GET /products?search=...**. Cette étape ne crée aucune route.

## GET /products

Renvoie tous les résultats, sans enveloppe ni pagination. Aucun corps requis. Sans paramètres, ordre par ID croissant ; une liste vide est [].

| Paramètre facultatif | Règle réellement implémentée |
|---|---|
| search | Sous-chaîne du nom OU de la description ; espaces externes retirés, blanc ignoré ; %, _ et ! traités comme texte littéral par échappement LIKE |
| category | Égalité exacte, sensible à la casse ; espaces externes retirés, blanc ignoré |
| minPrice | BigDecimal convertible, positif ou nul ; borne incluse |
| maxPrice | BigDecimal convertible, positif ou nul ; borne incluse |
| sort | Seulement name ou price, valeurs sensibles à la casse |
| direction | Seulement asc ou desc ; nécessite sort ; asc par défaut lorsque sort est fourni seul |

minPrice doit être inférieur ou égal à maxPrice. Les filtres se combinent avec AND ; la recherche nom/description utilise un OR parenthésé. Tri name avec COLLATE NOCASE ; égalités départagées par ID croissant. SQLite limite la gestion de casse Unicode. Aucun filtre d'Inventory ou de stock.

Exemples :

```text
GET /products
GET /products?search=laptop
GET /products?category=Electronics
GET /products?minPrice=1000&maxPrice=9000
GET /products?sort=name&direction=asc
GET /products?search=laptop&sort=price&direction=desc
```

Exemple fictif de forme de réponse :

```json
[
  {
    "id": 42,
    "name": "Clavier USB",
    "category": "Accessories",
    "price": 49.90,
    "image": "",
    "description": "Exemple documentaire"
  }
]
```

Erreurs : 400 pour prix non convertible/négatif, bornes inversées, colonne/direction inconnue ou direction sans sort. Les valeurs vides des paramètres numériques facultatifs peuvent être converties en absence par le binding MVC ; aucun contrat de rejet spécifique des paramètres répétés/inconnus n'est ajouté. Une erreur de persistance non traduite peut produire 500.

## GET /products/{id}

Exemple : http://localhost:8082/products/42. Paramètre id convertible en Long ; aucun corps ni paramètre de requête déclaré. Retourne 200 et l'objet à six champs illustré ci-dessous si présent.

Erreurs : 400 si ID non convertible ; 404 si absent. Aucune validation imposant un ID positif n'est déclarée.

## Modèle et corps POST/PUT

| Champ | Type Java / JSON | Entrée POST/PUT |
|---|---|---|
| id | Long / entier | Absent des DTO ; attribué par SQLite en POST, issu du chemin en PUT |
| name | String / chaîne | Obligatoire, @NotBlank |
| category | String / chaîne | Obligatoire, @NotBlank |
| price | BigDecimal / nombre | Obligatoire, @NotNull, minimum inclusif zéro |
| image | String / chaîne | Facultatif ; absent/null devient "" |
| description | String / chaîne | Facultatif ; absent/null devient "" |

POST utilise @DecimalMin("0"), PUT @DecimalMin("0.0"). Aucune longueur maximale, liste de catégories, validation d'URL ou règle de devise/arrondi n'est déclarée. Aucun contrat applicatif de rejet des propriétés JSON inconnues n'est défini. Ne pas envoyer id ou role dans le corps.

## POST /products

Créer un produit. Aucun paramètre d'URL. Nécessite Authorization: Bearer <access-token-Auth> et Content-Type: application/json.

Exemple fictif de requête :

```json
{
  "name": "Clavier USB",
  "category": "Accessories",
  "price": 49.90,
  "image": "",
  "description": "Exemple documentaire"
}
```

Succès : **201 Created**, avec les six champs. L'ID ci-dessous est illustratif, pas une valeur imposée :

```json
{
  "id": 42,
  "name": "Clavier USB",
  "category": "Accessories",
  "price": 49.90,
  "image": "",
  "description": "Exemple documentaire"
}
```

SQLite génère l'ID ; INSERT ... RETURNING relit la ligne. Aucun en-tête Location n'est explicitement construit. Erreurs métier : 400 corps/validation invalide ; pas de 404 métier à la création. Erreurs de sécurité : 401/403.

## PUT /products/{id}

Exemple : http://localhost:8082/products/42. Même corps à cinq champs et mêmes en-têtes que POST ; UpdateProductRequest validé par @Valid. L'ID provient exclusivement du chemin et n'est pas modifiable.

Il s'agit d'un remplacement complet : image/description omis ou null sont remis à "", pas conservés. Aucune création implicite.

Succès : **200 OK**, objet à six champs relu après UPDATE. Format de réponse identique à l'exemple POST, avec l'ID du chemin et les valeurs actualisées.

Erreurs : 400 ID non convertible, corps ou validation invalide ; 404 si le produit manque avant UPDATE, si aucune ligne n'est affectée ou s'il manque à la relecture ; 401/403 pour la sécurité.

## DELETE /products/{id}

Exemple : http://localhost:8082/products/42. Aucun corps requis ; Authorization: Bearer <access-token-Auth>. Supprime uniquement cet ID, sans action Inventory ou Orders.

Succès :

```http
HTTP/1.1 204 No Content
```

Corps vide, ni {} ni null. Erreurs : 400 ID non convertible ; 404 si zéro ligne supprimée, y compris suppression répétée ; 401/403 pour la sécurité.

## Validation et codes transversaux

- Nom/catégorie absent, null, vide ou blanc : 400.
- Prix absent/null/négatif : 400 ; zéro accepté.
- Corps JSON absent, mal formé ou valeur non convertible : 400.
- Type de contenu non pris en charge : 415 possible via MVC.
- JWT absent sur une écriture : 401.
- JWT mal signé, expiré hors tolérance, sans exp ou d'algorithme refusé : 401.
- JWT valide sans ADMIN reconnu : 403.
- Autre méthode/route : refus par défaut de Security ; ne pas promettre une 404 MVC pour une route rejetée en amont.
- Erreur de base non personnalisée : 500 possible.

Un Bearer invalide peut produire 401 même sur un GET public. Lire anonymement sans token mock. La sécurité est évaluée avant les validations métier : une requête invalide non authentifiée ne doit pas être supposée retourner 400.

Aucun @ControllerAdvice ou format JSON d'erreur applicatif uniforme n'est déclaré. La raison Product not found: <id> d'une ResponseStatusException n'est pas garantie dans le corps HTTP. Ne pas dépendre de la présence d'un champ message ou d'une liste d'erreurs.

## Sécurité et CORS

HS256 obligatoire ; claim exp requis. Le claim role est textuel et ADMIN est insensible à la casse depuis l'étape 22.1 ; son nom est configurable. iss/aud ne sont vérifiés que si leurs variables sont renseignées.

SecurityConfig autorise les origines exactes http://localhost:5173 et http://localhost:5174, les méthodes GET/POST/PUT/DELETE/OPTIONS et les en-têtes Authorization/Content-Type/Accept. Pré-vérifications valides sans token ; pas d'authentification par cookie. Voir [SECURITY.md](SECURITY.md) et [TESTING.md](TESTING.md).
