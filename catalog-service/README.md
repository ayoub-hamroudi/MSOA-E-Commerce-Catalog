# Catalog Service — MSOA E-Commerce

Catalog Service est le microservice chargé des informations produit : identifiant, nom, catégorie, prix, image et description. Il expose une API REST sur **http://localhost:8082** au frontend React du professeur et à l'extension ADMIN indépendante.

Le contrat initial du professeur exigeait les deux lectures GET. POST, PUT et DELETE sont des extensions protégées par JWT. Catalog ne gère ni comptes utilisateurs, ni émission de tokens d'authentification, ni quantités en stock.

Documentation alignée sur le code, livraison préparée le **9 novembre 2026**. Aucun code applicatif n'a été modifié pendant cette finalisation.

## Documentation

- [API et exemples JSON](docs/API.md)
- [SQLite et consultation sans modification](docs/DATABASE.md)
- [Sécurité JWT et secret de démarrage](docs/SECURITY.md)
- [Intégration React, Auth, Inventory et Orders](docs/INTEGRATION.md)
- [Tests isolés, résultats et couverture restante](docs/TESTING.md)

## Technologies et prérequis

| Élément | Configuration réelle |
|---|---|
| Java | Compilation release 17 ; suite exécutée sur Java 17.0.17 lors de cette étape |
| Spring Boot | 4.1.2 |
| HTTP et JSON | Spring Web MVC |
| Données | Spring JDBC / JdbcTemplate, sans JPA ni Hibernate |
| SQLite JDBC | org.xerial:sqlite-jdbc:3.54.1.0 |
| Validation | Jakarta Validation via le starter Boot |
| Sécurité | Spring Security 7.1.2, OAuth2 Resource Server, Nimbus JOSE |
| Build | Maven Wrapper configuré pour Maven 3.10.0 |
| Développement | Spring Boot DevTools |
| Interface associée | React 19, Vite et Material UI, dans le projet voisin |

Installer un **JDK 17 ou ultérieur**, définir JAVA_HOME vers le JDK et rendre Java accessible. Le wrapper fourni évite une installation Maven globale ; le premier lancement nécessite Internet pour les distributions et dépendances. Aucun serveur SQLite n'est requis. VS Code et ses extensions Java sont facultatifs.

## Compiler et démarrer sous Windows PowerShell

Ouvrir le dossier catalog-service dans VS Code et utiliser son terminal PowerShell à la racine :

```powershell
Set-Location '<chemin-vers-le-projet>\catalog-service'
java -version
.\mvnw.cmd -v
Test-Path .\data\demo\catalog-demo.db
# Initialiser la base locale selon la section SQLite ci-dessous.
.\mvnw.cmd clean compile
```

Avant le premier démarrage après clonage, créer la base locale à partir de la copie de démonstration, selon la section SQLite ci-dessous. Ne pas écraser une base existante. L'application n'exécute aucune création de table ou migration automatique.

Provisionner ensuite **MSOA_JWT_SECRET** avec la clé convenue avec Auth, en Base64 standard correspondant à au moins 32 octets décodés. Pour ne pas écrire sa valeur dans l'historique :

```powershell
$catalogSecretInput = Read-Host 'Cle partagee Auth/Catalog en Base64' -AsSecureString
$env:MSOA_JWT_SECRET = [System.Net.NetworkCredential]::new('', $catalogSecretInput).Password
.\mvnw.cmd spring-boot:run
```

Le serveur utilise 8082 ; garder ce terminal ouvert et arrêter avec Ctrl+C. Le secret est requis même pour démarrer un service dont les GET restent publics. Aucun secret par défaut n'est fourni. Ne pas afficher sa valeur, le stocker dans Git ou générer une clé différente à chaque démarrage.

Après arrêt, retirer la variable du terminal si nécessaire :

```powershell
Remove-Item Env:MSOA_JWT_SECRET
Remove-Variable catalogSecretInput
```

Dans un autre terminal, une lecture publique :

```powershell
Invoke-RestMethod -Method Get -Uri 'http://localhost:8082/products'
```

Le lancement doit se faire depuis la racine du service, car jdbc:sqlite:./data/catalog.db est relatif au répertoire courant. En cas de port occupé, identifier le service concerné avant de le relancer. Voir [SECURITY.md](docs/SECURITY.md) pour les paramètres facultatifs de JWT.

## Architecture et dossiers

```text
HTTP → Spring Security/CORS → ProductController
                              ↓
                         ProductService
                              ↓
                   ProductRepository (JdbcTemplate)
                              ↓
                       data/catalog.db
```

```text
catalog-service/
├── .mvn/wrapper/maven-wrapper.properties
├── mvnw / mvnw.cmd
├── pom.xml
├── README.md
├── docs/                     # API, DATABASE, SECURITY, INTEGRATION, TESTING
├── data/demo/catalog-demo.db  # copie de livraison : 7 produits
├── data/catalog.db            # base locale après initialisation, ignoree
├── src/main/java/com/msoa/catalog/
│   ├── CatalogServiceApplication.java
│   ├── config/               # SecurityConfig, JwtConfig
│   ├── controller/           # ProductController
│   ├── dto/                  # CreateProductRequest, UpdateProductRequest
│   ├── model/                # Product, record à six champs
│   ├── repository/           # ProductRepository
│   └── service/              # ProductService
├── src/main/resources/application.properties
├── src/test/java/com/msoa/catalog/
│   ├── CatalogServiceApplicationTests.java
│   └── config/SecurityConfigTest.java
└── target/                   # résultats Maven, ignorés par Git
```

L'utilitaire local update_images.py reste présent sur le poste de développement mais est exclu de Git. Il ne fait pas partie de la livraison et n'est pas nécessaire pour démarrer.

## Configuration actuelle

```properties
spring.application.name=catalog-service
server.port=8082
spring.datasource.url=jdbc:sqlite:./data/catalog.db
spring.datasource.driver-class-name=org.sqlite.JDBC
spring.datasource.hikari.maximum-pool-size=5
spring.sql.init.mode=never
```

La base de travail originale data/catalog.db reste **inchangée avec 8 produits** et est désormais ignorée par Git. La livraison fournit **data/demo/catalog-demo.db**, copie distincte avec **7 produits, IDs 1 à 7**. Seul l'ID 8, nommé laptop_test avec une image _, a été exclu de cette copie comme donnée explicite de test ; l'ID 7 HP EliteBook 840 est conservé. Schéma identique et intégrité ok. Aucun ID n'est renuméroté.

### Initialiser SQLite après clonage

```powershell
# Depuis la racine catalog-service, apres clonage :
if (-not (Test-Path -LiteralPath '.\data\catalog.db')) {
    [System.IO.File]::Copy(
        (Join-Path (Get-Location).Path 'data\demo\catalog-demo.db'),
        (Join-Path (Get-Location).Path 'data\catalog.db'),
        $false
    )
} else {
    Write-Host 'Base locale existante conservee : aucune copie effectuee.'
}
```

Le fichier local ainsi créé utilise le chemin JDBC existant, sans changement de configuration Spring. Ne jamais lancer le service directement sur la copie de démonstration : conserver celle-ci comme référence et utiliser la copie locale ignorée. Un clone initialise 7 produits ; le poste de développement conserve ses 8 produits. Les évolutions ultérieures de la base locale ne doivent pas être ajoutées à Git. Voir [DATABASE.md](docs/DATABASE.md) pour le contenu et les contrôles.

## Routes réelles

| Méthode | Route | Accès | Succès |
|---|---|---|---|
| GET | /products | Public | 200, tableau JSON |
| GET | /products/{id} | Public | 200, objet JSON |
| POST | /products | ADMIN | 201, produit créé |
| PUT | /products/{id} | ADMIN | 200, produit actualisé |
| DELETE | /products/{id} | ADMIN | 204, sans corps |

**GET /products/search n'est pas un endpoint dédié dans le code actuel.** La recherche s'effectue sur GET /products avec les paramètres facultatifs search, category, minPrice, maxPrice, sort et direction. Le chemin /products/search correspond au mapping /products/{id}, où search n'est pas convertible en Long : une requête publique sans token reçoit normalement 400.

Exemple : /products?search=laptop&category=Electronics&sort=price&direction=desc. Sans paramètres : tous les produits, triés par ID croissant. Aucune pagination.

Les requêtes POST/PUT utilisent cinq champs, sans ID ni rôle :

```json
{
  "name": "Clavier USB",
  "category": "Accessories",
  "price": 49.90,
  "image": "",
  "description": "Exemple documentaire"
}
```

Les réponses produit ajoutent id. Nom et catégorie non blancs ; prix obligatoire, supérieur ou égal à zéro ; facultatifs absents/null normalisés en chaînes vides. PUT remplace les cinq champs. Voir [API.md](docs/API.md).

## Sécurité et interfaces React

Les écritures exigent un JWT **HS256 valide**, avec exp obligatoire et un claim de rôle textuel. Le claim par défaut est role ; ADMIN, admin, Admin et aDmIn accordent le rôle Spring ROLE_ADMIN. Tableaux, nombres, USER, préfixe ROLE_ADMIN dans la valeur du claim et rôles multiples ne donnent pas ADMIN.

CORS est centralisé dans SecurityConfig, sans annotation CORS du contrôleur. Origines exactes autorisées : http://localhost:5173 et http://localhost:5174. Méthodes : GET, POST, PUT, DELETE, OPTIONS ; en-têtes : Authorization, Content-Type, Accept. CORS n'est pas un contrôle d'autorisation.

Le frontend officiel conserve le port 5173 et CATALOG en mode rest. L'extension ADMIN indépendante est disponible sur http://localhost:5174/src/admin-catalog/index.html. Ses lectures et filtres sont préparés ; ses écritures restent **désactivées dans l'interface et son client API** tant qu'Auth réel n'est pas intégré. Aucun frontend n'est modifié par cette finalisation.

## Tests et résultat technique

La suite complète a été exécutée le 7 novembre 2026 : **40 tests, 40 réussites, zéro échec/erreur/ignoré** : un chargement de contexte et 39 tests de sécurité. Les tests utilisent une clé éphémère et une datasource SQLite en mémoire ; aucune requête d'écriture n'est envoyée au serveur réel.

Pour reproduire cette exécution, utiliser le lanceur PowerShell isolé de [TESTING.md](docs/TESTING.md). Il lance .\mvnw.cmd test avec les variables nécessaires dans le processus enfant uniquement. Ne pas réutiliser la clé du service réel dans ces tests.

La couverture actuelle ne garantit pas tous les comportements métier : recherches SQL, filtres, DTO invalides, erreurs 404 et persistance restent des lacunes automatisées identifiées. Aucun pourcentage de couverture n'a été mesuré.

## Limites avant intégration

- **Auth :** backend non disponible dans les projets locaux audités ; compatibilité de l'émetteur non vérifiée. Coordonner clé, claims, rôle, dates, iss/aud et cycle de session.
- **Inventory :** propriétaire des quantités et mouvements de stock. Aucun appel Catalog–Inventory ni création de stock automatique.
- **Orders :** aucun backend disponible localement pour confirmer son contrat ; aucun appel direct depuis Catalog.
- Pas de rotation/révocation JWT automatique, migration, pagination, PATCH, transaction explicite englobant les lectures et l'UPDATE, ou gestion uniforme des erreurs applicatives.
- SQLite REAL ne garantit pas la précision monétaire décimale exacte malgré BigDecimal côté Java ; devise non définie par le contrat.
- Chaque microservice possède sa base et communique par API, sans accès direct aux bases des autres.

## Partage Git

Le dépôt Catalog est indépendant. .gitignore exclut target/, la base locale data/catalog.db, update_images.py, les journaux SQLite, temporaires, configurations locales et fichiers usuels de secrets. Seule data/demo/catalog-demo.db est destinée à être versionnée. Les règles ne protègent pas les fichiers déjà suivis ni tous les secrets possibles : examiner l'index avant commit. Ne pas versionner de secret, JWT signé ou fichier d'environnement sensible. La préparation 22.4 indexe les fichiers autorisés sans effectuer de commit, push ou création de dépôt distant.
