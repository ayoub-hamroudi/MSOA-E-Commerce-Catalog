# Extension indépendante — Administration Catalog

Cette extension est entièrement contenue dans src/admin-catalog. Aucun fichier React officiel, routage principal, configuration, dépendance, backend ou base n'est modifié. Aucun lien ni route n'est ajouté : **la page n'est pas accessible depuis l'application officielle à cette étape**. Retirer ce dossier suffit à retirer l'extension.

## Audit de l'authentification existante

- src/config/backend.js contient AUTH: "mock" et CATALOG: "rest".
- authService.login en mock crée un token mock-<UUID>, pas un JWT HS256.
- En mode REST, authService.login attend une réponse { user, token } et conserve la session dans localStorage sous msoa-shop-session ; getCurrentUser appelle /api/auth/me.
- AuthContext conserve user, loading et isAuthenticated ; il n'expose pas directement le JWT ni une preuve de rôle ADMIN validée.
- apiClient lit le token de cette session locale et l'attache à toutes les requêtes, y compris GET. Il ne vérifie pas cryptographiquement le JWT.
- ProtectedRoute vérifie la présence d'un utilisateur, pas une autorisation ADMIN confirmée par Catalog.

Ni user.role ni une session locale modifiable ne constituent une preuve d'autorisation. L'extension n'utilise donc pas ces mécanismes pour activer ses écritures et ne lit pas localStorage. Les lectures anonymes emploient leur propre client Fetch, l'URL API_URLS.CATALOG et credentials: omit, sans en-tête Authorization. Elles n'envoient jamais le token mock qui ferait échouer un GET public sécurisé.

## Fonctionnalités préparées

- Tableau des six champs Catalog, images HTTP(S) avec repli, description, liste vide, chargement, erreurs réseau/serveur et nouvelle tentative.
- Recherche nom/description, catégorie exacte, bornes de prix inclusives et tri name/price, asc/desc. Paramètres combinables, encodés par URLSearchParams, pas de pagination inventée.
- Formulaire de création et formulaire de remplacement PUT prérempli ; ID non modifiable, jamais inclus dans le corps.
- Nom/catégorie non blancs, prix fini et positif ou nul ; image/description facultatives envoyées comme chaînes. Pas de contrainte d'URL imposée au formulaire, conformément au DTO.
- Confirmation de suppression montrant le nom et l'ID.
- Rafraîchissement après succès et messages de réussite/erreur préparés pour la future intégration.
- Requêtes annulées lors des changements de filtres/démontages ; réponses obsolètes ignorées.

Les boutons Ajouter, Modifier et Supprimer sont désactivés. Les aperçus de formulaire permettent d'explorer les champs sans enregistrer. Le dialogue de suppression est développé mais sa commande n'est pas activable. Les mutations ne sont pas testées sur les données réelles.

## Verrou d'écriture et JWT

CATALOG_WRITES_ENABLED est une constante false dans services/adminCatalogApi.js. Ce verrou existe aussi dans le client API : même l'appel direct à createProduct/updateProduct/deleteProduct échoue avant Fetch. Aucun paramètre de page, rôle local, token saisi manuellement ou localStorage ne lève ce verrou.

Le client prépare POST /products, PUT /products/{id} et DELETE /products/{id}, avec Authorization: Bearer lorsqu'une intégration réelle sera disponible. Le futur adaptateur authentication.getAccessToken doit être fourni par une session Auth réelle et réagir à son expiration/déconnexion. Il n'est pas connecté actuellement. Changer seulement une valeur d'interface ne suffit pas : le client exige aussi cet adaptateur. Aucun secret HMAC, JWT généré ou faux ADMIN n'est inclus.

Catalog doit toujours valider signature HS256, dates, claims configurés et rôle ADMIN. Une forme de token ou un rôle lu en JavaScript n'est pas une validation de signature.

Messages préparés : 400 validation/requête, 401 session absente/invalide/expirée, 403 ADMIN non reconnu, 404 produit disparu, 5xx erreur serveur. DELETE 204 est géré sans lecture JSON. Le corps POST/PUT est limité aux cinq champs ; aucun rôle ni ID n'est envoyé.

## Intégration ultérieure, uniquement après autorisation académique

1. Faire autoriser l'ajout d'une route ou d'un point d'entrée dédié par le professeur. Ne pas modifier App.jsx/main.jsx dans cette étape.
2. Importer AdminCatalogPage depuis ce dossier dans le futur point d'entrée autorisé. Le composant utilise seulement React/Material UI et peut être monté dans le thème existant ; il ne nécessite pas AuthProvider ou BrowserRouter pour son aperçu.
3. Démarrer Catalog sur localhost:8082 selon sa documentation, avec son secret serveur correctement provisionné. Les origines http://localhost:5173 et http://localhost:5174 sont désormais autorisées par Catalog ; le point d’entrée indépendant sur 5174 est décrit ci-dessous.
4. Pour activer les mutations lors d'une future étape, confirmer le contrat Auth réel : JWT HS256, claim ADMIN, expiration, iss/aud, session et gestion de déconnexion. Fournir l'adaptateur getAccessToken aux méthodes API depuis les handlers de la page, ajouter une politique d'accès UI cohérente puis lever explicitement le verrou constant après revue. Ne jamais le faire à partir d'un simple rôle de localStorage.
5. Vérifier alors les réponses 401/403 et les opérations métier dans un environnement convenu. Un garde React améliore l'UX ; la sécurité reste dans Catalog.

Exemple d'import futur (aucun ajout au routage n'a été effectué) :

```jsx
import AdminCatalogPage from "./admin-catalog/AdminCatalogPage";
```

## Vérification et limites

Depuis la racine frontend : npm run build et npm run lint. Le build officiel n'importe pas cette extension, volontairement non routée ; il faut aussi compiler son point d'entrée séparément pour vérifier ses imports/JSX sans changer l'application. Les résultats réellement obtenus sont rapportés dans le chat, sans revendiquer de test fonctionnel des écritures.

Aucune dépendance ajoutée, aucune installation npm nécessaire. Les prix utilisent Number côté navigateur : les limites de précision JavaScript restent applicables, contrairement à BigDecimal côté Java. Aucune devise n'est imposée par l'extension. Recherche/catégorie suivent les limites réelles du backend (catégorie exacte, casse Unicode SQLite limitée). Inventory et les autres services ne sont pas intégrés. Les contraintes/réponses du backend restent la référence.

## Visualisation indépendante — étape 19

Un point d'entrée dédié est maintenant disponible, sans route ajoutée au frontend officiel.

Depuis la racine MSOA-E-com-Demo, dans un terminal PowerShell :

```powershell
.\node_modules\.bin\vite.cmd --config src/admin-catalog/vite.admin.config.mjs
```

Ouvrir **http://localhost:5174/src/admin-catalog/index.html**. Le port 5174 est strict : si occupé, le lancement échoue au lieu de choisir un autre port. Le frontend officiel conserve sa commande npm run dev et le port 5173 ; sa configuration n'est pas modifiée. Arrêter le serveur ADMIN avec Ctrl+C dans son terminal.

Fichiers d'entrée dédiés : index.html, main.jsx et vite.admin.config.mjs, tous dans ce dossier. Le montage réutilise AdminCatalogPage, Material UI et les composants existants, sans AuthProvider officiel ni nouvelle dépendance.

Le client continue d'appeler directement API_URLS.CATALOG (http://localhost:8082). **Aucun proxy n'est ajouté. Le backend autorise les origines http://localhost:5173 et http://localhost:5174 depuis l'étape 20.** La bannière CORS historique a été retirée. Les véritables erreurs réseau/serveur restent affichées ; un service arrêté reste une indisponibilité réseau.

La page, les filtres et les aperçus de formulaires restent visibles même lorsque les données ne peuvent pas être chargées. Aucun produit fictif ne remplace la réponse de l'API. POST, PUT et DELETE restent bloqués dans l'interface et dans le client API en attendant Auth réel.

### Compilation

```powershell
npm run build
.\node_modules\.bin\vite.cmd build --config src/admin-catalog/vite.admin.config.mjs
.\node_modules\.bin\eslint.cmd src/admin-catalog
```

La première commande compile l'application officielle. La deuxième vérifie réellement le HTML et le point d'entrée ADMIN et écrit dans dist/admin-catalog, sans modifier les sources officielles. Exécuter les builds dans cet ordre : le build officiel nettoie dist. Le lint global peut signaler des erreurs préexistantes hors extension ; seules les erreurs de l'extension doivent être corrigées dans cette étape.

L'application officielle reste inchangée et aucune route ADMIN ne lui est ajoutée. L'accès indépendant ne constitue pas une activation des mutations ni une validation de l'authentification.

## Consultation — étape 21

La liste rend tous les éléments du tableau renvoyé par GET /products, sans limite locale ni nombre de produits imposé. Le nombre affiché dépend des données et des critères actifs ; une capture partielle du tableau n'indique pas son nombre total de lignes. Utiliser le défilement vertical et, sur petit écran, horizontal pour parcourir les colonnes.

Appliquer et Réinitialiser déclenchent désormais une nouvelle lecture même si les critères sont identiques à la précédente requête. Réinitialiser efface recherche, catégorie, deux prix et tri, puis recharge GET /products sans paramètres. Actualiser conserve les critères appliqués (les valeurs saisies mais non appliquées ne sont pas utilisées). Les GET utilisent cache: no-store. AbortController et le garde de réponse active empêchent une réponse obsolète de remplacer la requête actuelle.

Une recherche sans correspondance affiche l'état vide ; les bornes inversées sont refusées côté formulaire. Les actions POST/PUT/DELETE restent désactivées dans l'interface et le client API. Aucun produit fictif n'est ajouté.
