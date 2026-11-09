# Intégration d'équipe — Catalog Service

## État vérifié au 7 novembre 2026

| Composant | État vérifiable |
|---|---|
| Catalog | API locale sur 8082, autonome avec sa base et son secret de démarrage |
| Frontend officiel | React sur 5173, CATALOG en rest, autres services en mock |
| Extension ADMIN | Point d'entrée indépendant sur 5174 ; consultation préparée et validée lors de l'étape 21 ; écritures désactivées |
| Auth backend | Non disponible dans les projets locaux audités ; contrat réel non vérifié |
| Inventory backend | Non disponible pour une intégration locale réelle |
| Orders backend | Non disponible localement ; contrat serveur à confirmer |

La présence de clients React ou de bases de démarrage ne prouve pas qu'un backend existe ou qu'un contrat serveur est implémenté.

## Catalog et React

Base : **http://localhost:8082** ; routes sans préfixe /api. Voir [README](../README.md) pour le démarrage : après clonage, copier data/demo/catalog-demo.db vers data/catalog.db uniquement si la base locale n'existe pas, provisionner MSOA_JWT_SECRET et lancer depuis la racine. La copie de livraison contient 7 produits (IDs 1 à 7) ; l'original local de développement conserve ses 8 produits. Le produit de test ID 8 est exclu uniquement de la copie de livraison. Aucune modification de la configuration Spring n'est nécessaire.

Dans le frontend, src/config/backend.js contient actuellement :

```javascript
const BACKEND_MODE = {
  AUTH: "mock",
  CATALOG: "rest",
  INVENTORY: "mock",
  ORDERS: "mock",
  PAYMENTS: "mock",
  SHIPPING: "mock",
};
```

API_URLS.CATALOG vaut http://localhost:8082. Le client Catalog officiel appelle GET /products et GET /products/{id}, et transforme la 404 unitaire en null. La liste est un tableau direct contenant id, name, category, price, image, description ; pas de stock.

Depuis le dossier frontend, dans deux terminaux distincts :

```powershell
# Frontend officiel
npm run dev -- --port 5173 --strictPort
```

```powershell
# Extension ADMIN, sans modification du routage officiel
.\node_modules\.bin\vite.cmd --config src/admin-catalog/vite.admin.config.mjs
```

URLs : http://localhost:5173 et **http://localhost:5174/src/admin-catalog/index.html**.

CORS est centralisé dans SecurityConfig : les deux origines exactes sont autorisées, avec GET/POST/PUT/DELETE/OPTIONS et Authorization/Content-Type/Accept. Aucun proxy ou changement des fichiers officiels n'est requis pour ces lectures. Un autre hostname, port ou schéma constitue une autre origine.

L'extension ADMIN utilise des GET anonymes, filtres REST, états de chargement/erreur/vide et réinitialisation. POST/PUT/DELETE restent bloqués par CATALOG_WRITES_ENABLED=false dans l'interface et son client. Aucun secret ou faux JWT n'est présent.

Le client HTTP officiel lit une session de localStorage et peut joindre un token mock même sur GET ; un Bearer invalide peut être refusé par Security. Le client admin évite cela en ne joignant pas de token aux lectures publiques.

## Catalog et Auth — contrat encore à confirmer

Catalog vérifie localement **HS256**. Auth devra signer avec les mêmes octets de clé ; Catalog attend leur représentation en Base64 standard dans MSOA_JWT_SECRET, au moins 32 octets décodés.

Le claim par défaut est role, configuré par MSOA_JWT_ROLE_CLAIM. Il doit être textuel ; ADMIN est reconnu sans distinction de casse et devient ROLE_ADMIN. Pas de tableau roles/authorities, de rôle de remplacement ou d'autorisation depuis le corps JSON.

exp est obligatoire ; exp/nbf sont vérifiés avec une tolérance de 60 secondes. MSOA_JWT_ISSUER et MSOA_JWT_AUDIENCE activent iss/aud uniquement lorsqu'ils sont renseignés. Aucune valeur par défaut du contrat Auth n'est inventée.

Avant d'intégrer, demander : endpoint de connexion, réponse JSON exacte, algorithme et typ, claims, format du rôle, durée/renouvellement, iss/aud, distribution sécurisée et rotation de la clé. Ne jamais transmettre un secret de production dans Git ou une conversation.

Le frontend officiel attend en mode rest une réponse {user, token}, mais **cette attente ne prouve pas le contrat Auth réel**. AuthContext ne fournit pas actuellement un adaptateur de token à l'extension. Le point prévu est authentication.getAccessToken dans adminCatalogApi ; les handlers ne lui passent pas encore de session réelle.

Un rôle lu dans localStorage ou un JWT simplement décodé n'est pas une preuve d'autorisation. Gérer expiration/déconnexion, 401 et 403 avant de lever le verrou des écritures dans une étape autorisée. Catalog reste l'autorité d'accès.

## Catalog et Inventory — responsabilités séparées

Catalog possède les informations produit. Inventory possède les quantités et mouvements/réservations/libérations de stock. Le lien métier prévu est **productId** ; il doit être convenu avec le responsable Inventory, sans jointure directe entre bases.

Aucun appel Catalog–Inventory n'est implémenté. Un ajout Catalog ne crée pas automatiquement de stock ; une suppression Catalog ne supprime pas automatiquement les références Inventory.

Le mock React initialise son stock depuis src/data/products.js puis localStorage ; un ID inconnu reçoit zéro. Un produit peut donc être visible et indisponible à l'achat. Ce comportement mock n'est pas une validation du futur service Inventory.

À convenir ensemble : création/initialisation du stock, suppression/désactivation d'un produit référencé, erreurs, reprises et cohérence entre services. Ne pas déplacer le stock dans Catalog pour contourner l'absence d'Inventory.

## Catalog et Orders — limites du contrat vérifié

Aucun backend Orders n'est disponible dans les projets voisins audités et aucun appel Orders n'existe dans Catalog. Le frontend et ses données de départ décrivent des articles utilisant productId et des informations de produit, mais ce n'est pas la preuve d'un contrat serveur final.

Les besoins de lecture Catalog, la copie du prix/nom dans une commande, la gestion d'un produit supprimé et la coordination avec Inventory restent **à confirmer avec le responsable Orders**. Aucune réservation ou validation de commande par Catalog n'est annoncée.

## Autonomie et vérifications

Chaque microservice doit posséder sa propre base. Communiquer par API ; ne jamais ouvrir directement la base d'un autre service. Catalog peut démarrer sans Auth ou Inventory en ligne si sa base et sa clé sont provisionnées ; cela ne valide pas l'intégration des écritures.

Vérifications de lecture possibles :

```powershell
Invoke-WebRequest -Uri 'http://localhost:8082/products' -Headers @{Origin='http://localhost:5173'}
Invoke-WebRequest -Uri 'http://localhost:8082/products' -Headers @{Origin='http://localhost:5174'}
```

Vérifier le statut et Access-Control-Allow-Origin. Aucun POST/PUT/DELETE réel ne doit être exécuté sans étape autorisée et données contrôlées.

Les tests isolés de Catalog sont documentés dans [TESTING.md](TESTING.md). Ils ne remplacent pas une future validation interservices. Ne pas commencer Auth/Inventory dans cette étape documentaire.
