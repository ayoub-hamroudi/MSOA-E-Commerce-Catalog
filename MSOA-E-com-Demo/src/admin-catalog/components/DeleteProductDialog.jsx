import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";

export default function DeleteProductDialog({ product, onClose, onConfirm, writeEnabled, busy, serverError }) {
  return (
    <Dialog open fullWidth maxWidth="xs" onClose={busy ? undefined : onClose} aria-labelledby="delete-product-title">
      <DialogTitle id="delete-product-title">Supprimer ce produit ?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Vous allez supprimer « {product.name} » (ID {product.id}). Cette action est définitive.
          Elle ne supprime pas les références dans Inventory ou les commandes.
        </DialogContentText>
        {!writeEnabled && <Alert severity="info" sx={{ mt: 2 }}>Authentification ADMIN réelle nécessaire. Suppression désactivée.</Alert>}
        {serverError && <Alert severity="error" sx={{ mt: 2 }}>{serverError}</Alert>}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={busy}>Annuler</Button>
        <Button color="error" variant="contained" disabled={!writeEnabled || busy}
          onClick={() => { if (writeEnabled && !busy) onConfirm(); }}>
          {busy ? "Suppression…" : "Supprimer"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
