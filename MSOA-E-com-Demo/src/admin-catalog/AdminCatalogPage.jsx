import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, Container, Snackbar, Stack, Typography,
} from "@mui/material";
import { AddOutlined, RefreshOutlined, StorefrontOutlined, VisibilityOutlined } from "@mui/icons-material";
import ProductAdminTable from "./components/ProductAdminTable";
import ProductFormDialog from "./components/ProductFormDialog";
import DeleteProductDialog from "./components/DeleteProductDialog";
import ProductFilters from "./components/ProductFilters";
import { adminCatalogApi, ADMIN_AUTH_MESSAGE, CATALOG_WRITES_ENABLED } from "./services/adminCatalogApi";

export default function AdminCatalogPage() {
  const [filters, setFilters] = useState({});
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ key: null, products: [], error: "" });
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [operationError, setOperationError] = useState("");
  const [success, setSuccess] = useState("");
  const requestKey = JSON.stringify({ filters, revision });
  const loading = result.key !== requestKey;
  const loadError = loading ? "" : result.error;
  const writeEnabled = CATALOG_WRITES_ENABLED;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const { filters: requestedFilters } = JSON.parse(requestKey);
    adminCatalogApi.listProducts(requestedFilters, { signal: controller.signal })
      .then((products) => {
        if (active) setResult({ key: requestKey, products, error: "" });
      })
      .catch((error) => {
        if (active && error.name !== "AbortError") {
          setResult({ key: requestKey, products: [], error: error.message });
        }
      });
    return () => { active = false; controller.abort(); };
  }, [requestKey]);

  const refresh = () => setRevision((current) => current + 1);
  const applyFilters = (nextFilters) => {
    setFilters(nextFilters);
    // Always reload, even when resetting or applying identical criteria again.
    setRevision((current) => current + 1);
  };
  const openForm = (product = null) => { setOperationError(""); setDialog({ kind: "form", product }); };
  const openDelete = (product) => { setOperationError(""); setDialog({ kind: "delete", product }); };
  const closeDialog = () => { if (!busy) { setDialog(null); setOperationError(""); } };

  async function saveProduct(payload) {
    if (!writeEnabled || busy) return;
    setBusy(true);
    setOperationError("");
    try {
      // Future Auth adapter must be wired here before writes are enabled.
      if (dialog.product) await adminCatalogApi.updateProduct(dialog.product.id, payload);
      else await adminCatalogApi.createProduct(payload);
      setDialog(null);
      setSuccess(dialog.product ? "Produit modifié." : "Produit créé.");
      refresh();
    } catch (error) {
      setOperationError(error.message);
      if (error.status === 404) refresh();
    } finally { setBusy(false); }
  }

  async function deleteProduct() {
    if (!writeEnabled || busy) return;
    setBusy(true);
    setOperationError("");
    try {
      await adminCatalogApi.deleteProduct(dialog.product.id);
      setDialog(null);
      setSuccess("Produit supprimé.");
      refresh();
    } catch (error) {
      setOperationError(error.message);
      if (error.status === 404) refresh();
    } finally { setBusy(false); }
  }

  return (
    <Box component="main" sx={{ minHeight: "100vh", bgcolor: "#f8fafc", py: { xs: 3, md: 5 } }}>
      <Container maxWidth="xl">
        <Stack spacing={3}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}>
            <Box>
              <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: "center" }}>
                <StorefrontOutlined color="primary" />
                <Typography variant="overline" color="text.secondary">MSOA · Catalog Service</Typography>
                <Chip size="small" label="Lecture seule" variant="outlined" />
              </Stack>
              <Typography component="h1" variant="h4" fontWeight={800}>Administration du catalogue</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>Consultez les produits et préparez leur gestion.</Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={refresh} disabled={loading || busy}>Actualiser</Button>
              <Button variant="contained" startIcon={<AddOutlined />} disabled={!writeEnabled || busy} onClick={() => openForm()}>
                Ajouter un produit
              </Button>
            </Stack>
          </Stack>
          <Alert severity="info">{ADMIN_AUTH_MESSAGE} Les lectures restent publiques ; aucun token mock n’est envoyé.</Alert>
          <ProductFilters busy={loading || busy} onApply={applyFilters} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
            <Typography variant="body2" color="text.secondary" aria-live="polite">
              {loading ? "Chargement…" : loadError ? "Catalogue indisponible" : `${result.products.length} produit(s) affiché(s) · sans pagination serveur`}
            </Typography>
            <Button startIcon={<VisibilityOutlined />} size="small" onClick={() => openForm()}>Aperçu du formulaire de création</Button>
          </Stack>
          {loadError ? <Alert severity="error" action={<Button color="inherit" onClick={refresh}>Réessayer</Button>}>{loadError}</Alert> :
            <ProductAdminTable products={result.products} loading={loading} writeEnabled={writeEnabled && !busy}
              onPreview={openForm} onEdit={openForm} onDelete={openDelete} />}
        </Stack>
      </Container>
      {dialog?.kind === "form" && <ProductFormDialog key={dialog.product?.id ?? "create"} product={dialog.product}
        writeEnabled={writeEnabled} busy={busy} serverError={operationError} onClose={closeDialog} onSave={saveProduct} />}
      {dialog?.kind === "delete" && <DeleteProductDialog product={dialog.product}
        writeEnabled={writeEnabled} busy={busy} serverError={operationError} onClose={closeDialog} onConfirm={deleteProduct} />}
      <Snackbar open={Boolean(success)} autoHideDuration={5000} onClose={() => setSuccess("")}>
        <Alert severity="success" variant="filled" onClose={() => setSuccess("")}>{success}</Alert>
      </Snackbar>
    </Box>
  );
}
