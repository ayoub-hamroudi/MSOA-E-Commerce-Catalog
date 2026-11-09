# SQLite — Catalog Service

## Emplacement et état observé

- Fichier : **data/catalog.db**, relatif à la racine du service.
- URL : jdbc:sqlite:./data/catalog.db.
- Pilote : org.sqlite.JDBC, version Maven 3.54.1.0.
- Table métier : products.
- Propriétaire : Catalog Service exclusivement.
- Original vérifié en lecture seule le 9 novembre 2026 : **8 produits**, intégrité SQLite **ok**.
- Copie de livraison : **data/demo/catalog-demo.db**, **7 produits**, intégrité **ok**, même schéma.

Le nombre décrit une observation, pas une limite ou un seed automatiquement rejoué. La base originale est conservée sans changement et ignorée par Git. La copie de démonstration a été préparée séparément avec une sauvegarde SQLite cohérente, puis le seul produit explicite de test a été retiré de cette copie uniquement.

## Schéma réel

Définition lue dans sqlite_master. Ce bloc est une référence, pas une migration à exécuter :

```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL CHECK(price >= 0),
    image TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT ''
);
```

| Colonne | Type SQL déclaré | Type Java | Contraintes |
|---|---|---|---|
| id | INTEGER | Long | PRIMARY KEY ; généré si omis à l'insertion |
| name | TEXT | String | NOT NULL |
| category | TEXT | String | NOT NULL |
| price | REAL | BigDecimal | NOT NULL, CHECK(price >= 0) |
| image | TEXT | String | NOT NULL, DEFAULT '' |
| description | TEXT | String | NOT NULL, DEFAULT '' |

id est un INTEGER PRIMARY KEY SQLite, sans AUTOINCREMENT : ne pas promettre que les IDs supprimés ne seront jamais réutilisés. Aucun index secondaire, contrainte UNIQUE sur le nom ou clé étrangère n'a été observé.

Les noms/catégories non blancs sont contrôlés par les DTO HTTP, pas par une contrainte SQL équivalente. REAL n'assure pas un stockage décimal monétaire exact malgré BigDecimal en Java. Aucune devise n'est fixée par le contrat.

## Méthodes JDBC

ProductRepository utilise JdbcTemplate :

- findAll : SELECT des six colonnes, filtres paramétrés facultatifs, tri par ID par défaut.
- Recherche : LIKE sur LOWER(name)/LOWER(description), métacaractères échappés.
- Catégorie exacte et bornes de prix inclusives via paramètres ?.
- Tri construit uniquement à partir de fragments fixes sur liste blanche name/price et ASC/DESC.
- findById : WHERE id = ?.
- save : INSERT des cinq champs sans ID, puis RETURNING des six colonnes.
- update : UPDATE des cinq champs via WHERE id = ?, nombre de lignes retourné.
- deleteById : DELETE ciblé WHERE id = ?, nombre de lignes retourné.

Les facultatifs null sont normalisés en chaînes vides par le code ; un DEFAULT SQL ne remplace pas un NULL explicite. Le service vérifie l'existence/résultat avant de retourner une 404. Aucune migration ou initialisation automatique : spring.sql.init.mode=never.

## Fournir la base au démarrage

Le service attend une base préparée. Le dépôt fournit data/demo/catalog-demo.db ; data/catalog.db est la base locale ignorée par Git. Depuis la racine après clonage, créer la copie locale uniquement si elle n'existe pas :

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

Cette copie conserve le JDBC existant jdbc:sqlite:./data/catalog.db. Ne pas pointer le service vers data/demo/catalog-demo.db : la référence livrée doit rester stable. Une base locale existante, y compris celle du poste de développement avec huit produits, n'est jamais remplacée.

Le projet du professeur possède une base de départ sous msoa_sqlite_databases/catalog/, mais elle peut différer de la copie locale. Ne pas rejouer automatiquement ses scripts sur une base peuplée. Un mauvais répertoire courant peut provoquer la création d'un fichier vide puis une erreur no such table: products.

Pour une future mise à jour du jeu de démonstration, utiliser une sauvegarde SQLite cohérente et revoir explicitement les lignes à conserver. Ne pas committer la base active ou ses journaux transitoires. La préparation courante n'a fait aucune modification dans l'original.

### Contenu de la démonstration

| ID | Produit retenu |
|---|---|
| 1 | ThinkPad Laptop |
| 2 | Wireless Mouse |
| 3 | Mechanical Keyboard |
| 4 | USB-C Hub |
| 5 | 27-inch Monitor |
| 6 | Laptop Backpack |
| 7 | HP EliteBook 840 |

L'ID 8 laptop_test est exclu **de la copie uniquement** : son nom identifie un test et son champ image vaut _. Aucun autre produit n'est retiré ; les six champs des produits conservés sont identiques à l'original. Le nom HP EliteBook 840 et ses données ne présentent pas ce marqueur de test : l'ID 7 reste dans la démonstration.

Contrôles réalisés sur la copie : schéma SQLite identique, IDs uniques 1 à 7 inchangés, PRAGMA integrity_check=ok, PRAGMA foreign_key_check sans erreur et égalité de toutes les lignes retenues avec l'original. Le contrôle SHA-256 de l'original avant/après confirme son absence de modification.

Empreinte SHA-256 de la copie livrée : d83b6400bce59d01a3fb4a69255ec6dfa190b022748011330806eeb82d3175a5.

Aucun script SQL d'initialisation autonome n'est ajouté : la reproduction initiale repose sur le binaire de démonstration versionné et sa copie locale. Une future stratégie schema.sql/seed.sql nécessitera une étape distincte.

## Vérifier sans modifier

Avec SQLite CLI installé, depuis la racine :

```powershell
sqlite3 -readonly .\data\catalog.db
```

Dans SQLite :

```sql
PRAGMA integrity_check;
.schema products
PRAGMA table_info(products);
PRAGMA index_list(products);
PRAGMA foreign_key_list(products);
SELECT COUNT(*) FROM products;
SELECT id, name, category, price, image, description FROM products ORDER BY id;
.quit
```

Alternative Python 3, en lecture seule :

```powershell
@'
import sqlite3
from pathlib import Path
uri = Path("data/catalog.db").resolve().as_uri() + "?mode=ro"
with sqlite3.connect(uri, uri=True) as db:
    print(db.execute("PRAGMA integrity_check").fetchall())
    print(db.execute("PRAGMA table_info(products)").fetchall())
    print(db.execute("SELECT count(*) FROM products").fetchone())
'@ | python -
```

L'utilitaire local update_images.py écrit dans la base et est exclu de la livraison. Il n'est requis ni pour l'initialisation ni pour la consultation.

## Frontières métier et tests

Aucune colonne de stock. Inventory possède les quantités et mouvements de stock ; le lien métier prévu est productId, via API, sans accès direct aux bases des autres services. Aucun appel Inventory n'est implémenté dans Catalog.

Les tests de sécurité utilisent un ProductService simulé. Le chargement complet de contexte doit être lancé avec une datasource SQLite en mémoire, selon [TESTING.md](TESTING.md), pour protéger data/catalog.db.
