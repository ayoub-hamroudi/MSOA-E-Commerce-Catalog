import { API_URLS } from "../../config/backend";

// Intentionally locked until the real Auth contract has been integrated.
// No prop, localStorage value or HTTP parameter can enable writes.
export const CATALOG_WRITES_ENABLED = false;
export const ADMIN_AUTH_MESSAGE =
  "Les écritures sont désactivées : une authentification ADMIN réelle, compatible avec Auth Service, est nécessaire.";

export class AdminCatalogError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = "AdminCatalogError";
    this.status = status;
  }
}

function priceValue(value, label) {
  if (value === "" || value == null || !Number.isFinite(Number(value)) || Number(value) < 0) {
    throw new AdminCatalogError(`${label} doit être un nombre positif ou nul.`);
  }
  return Number(value);
}

function queryString(filters) {
  const query = new URLSearchParams();
  for (const key of ["search", "category"]) {
    const value = String(filters[key] ?? "").trim();
    if (value) query.set(key, value);
  }
  const min = filters.minPrice === "" || filters.minPrice == null
    ? null : priceValue(filters.minPrice, "Le prix minimum");
  const max = filters.maxPrice === "" || filters.maxPrice == null
    ? null : priceValue(filters.maxPrice, "Le prix maximum");
  if (min !== null && max !== null && min > max) {
    throw new AdminCatalogError("Le prix minimum doit être inférieur ou égal au maximum.");
  }
  if (min !== null) query.set("minPrice", String(min));
  if (max !== null) query.set("maxPrice", String(max));
  if (filters.sort) {
    if (!["name", "price"].includes(filters.sort)) {
      throw new AdminCatalogError("Colonne de tri non reconnue.");
    }
    const direction = filters.direction || "asc";
    if (!["asc", "desc"].includes(direction)) {
      throw new AdminCatalogError("Direction de tri non reconnue.");
    }
    query.set("sort", filters.sort);
    query.set("direction", direction);
  } else if (filters.direction && filters.direction !== "asc") {
    throw new AdminCatalogError("Sélectionnez une colonne avant de choisir une direction.");
  }
  return query.size ? `?${query.toString()}` : "";
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URLS.CATALOG}${path}`, {
      ...options,
      credentials: "omit",
      headers: { Accept: "application/json", ...options.headers },
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new AdminCatalogError(
      "Catalogue inaccessible. Vérifiez le service sur le port 8082, le réseau et l’origine CORS."
    );
  }
  if (!response.ok) {
    const messages = {
      400: "La requête est invalide. Vérifiez les champs et les filtres.",
      401: "La session réelle est absente, invalide ou expirée.",
      403: "Accès refusé : le JWT doit porter le rôle ADMIN reconnu par Catalog.",
      404: "Ce produit n’existe plus. Actualisez la liste.",
    };
    throw new AdminCatalogError(
      messages[response.status] || (response.status >= 500
        ? "Erreur du serveur Catalog. Réessayez ultérieurement."
        : `La requête a échoué (HTTP ${response.status}).`),
      response.status
    );
  }
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    throw new AdminCatalogError("Le service Catalog a retourné une réponse JSON illisible.");
  }
}

async function writeHeaders(authentication) {
  if (!CATALOG_WRITES_ENABLED) throw new AdminCatalogError(ADMIN_AUTH_MESSAGE);
  // Future integration point: an adapter to a real Auth session, never a raw
  // role/localStorage check. Catalog remains the authorization authority.
  if (typeof authentication?.getAccessToken !== "function") {
    throw new AdminCatalogError("L’adaptateur de session Auth réelle est absent.");
  }
  const token = await authentication.getAccessToken();
  if (typeof token !== "string" || !token.trim() || token.startsWith("mock-")) {
    throw new AdminCatalogError("Une session Auth réelle avec un Bearer token est nécessaire.");
  }
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function productBody(product) {
  if (!product.name?.trim() || !product.category?.trim()) {
    throw new AdminCatalogError("Le nom et la catégorie sont obligatoires.");
  }
  return JSON.stringify({
    name: product.name.trim(),
    category: product.category.trim(),
    price: priceValue(product.price, "Le prix"),
    image: product.image ?? "",
    description: product.description ?? "",
  });
}

function productPath(id) {
  if (id == null || String(id).trim() === "") {
    throw new AdminCatalogError("L’identifiant du produit est manquant.");
  }
  return `/products/${encodeURIComponent(String(id))}`;
}

export const adminCatalogApi = {
  async listProducts(filters = {}, { signal } = {}) {
    // Public GET must not inherit the professor's mock token.
    const products = await request(`/products${queryString(filters)}`, { signal, cache: "no-store" });
    if (!Array.isArray(products)) {
      throw new AdminCatalogError("Le contrat Catalog attend un tableau JSON de produits.");
    }
    return products;
  },
  async createProduct(product, authentication) {
    const headers = await writeHeaders(authentication);
    return request("/products", { method: "POST", headers, body: productBody(product) });
  },
  async updateProduct(id, product, authentication) {
    const headers = await writeHeaders(authentication);
    return request(productPath(id), { method: "PUT", headers, body: productBody(product) });
  },
  async deleteProduct(id, authentication) {
    const headers = await writeHeaders(authentication);
    return request(productPath(id), { method: "DELETE", headers });
  },
};
