import { useState } from "react";
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography,
} from "@mui/material";

export default function ProductFormDialog({ product, onClose, onSave, writeEnabled, busy, serverError }) {
  const editing = product != null;
  const [values, setValues] = useState(() => ({
    name: product?.name ?? "", category: product?.category ?? "",
    price: product?.price == null ? "" : String(product.price),
    image: product?.image ?? "", description: product?.description ?? "",
  }));
  const [errors, setErrors] = useState({});
  const change = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  function submit(event) {
    event.preventDefault();
    const next = {};
    if (!values.name.trim()) next.name = "Le nom est obligatoire.";
    if (!values.category.trim()) next.category = "La catégorie est obligatoire.";
    if (values.price.trim() === "" || !Number.isFinite(Number(values.price)) || Number(values.price) < 0) {
      next.price = "Saisissez un prix positif ou nul.";
    }
    setErrors(next);
    if (Object.keys(next).length || !writeEnabled || busy) return;
    onSave({ name: values.name.trim(), category: values.category.trim(),
      price: Number(values.price), image: values.image, description: values.description });
  }

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={busy ? undefined : onClose} aria-labelledby="product-form-title">
      <DialogTitle id="product-form-title">
        {!writeEnabled ? "Aperçu du formulaire" : editing ? "Modifier le produit" : "Ajouter un produit"}
      </DialogTitle>
      <form onSubmit={submit}>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            {!writeEnabled && <Alert severity="info">Mode préparation : vous pouvez explorer le formulaire.
              Aucun enregistrement n’est possible sans intégration ADMIN réelle.</Alert>}
            {editing && <Typography variant="body2" color="text.secondary">
              Produit #{product.id} · Identifiant non modifiable
            </Typography>}
            {serverError && <Alert severity="error">{serverError}</Alert>}
            <TextField label="Nom" required value={values.name} onChange={change("name")} disabled={busy}
              error={Boolean(errors.name)} helperText={errors.name} autoFocus />
            <TextField label="Catégorie" required value={values.category} onChange={change("category")} disabled={busy}
              error={Boolean(errors.category)} helperText={errors.category} />
            <TextField label="Prix" type="number" required value={values.price} onChange={change("price")}
              disabled={busy} error={Boolean(errors.price)} helperText={errors.price || "Zéro est accepté."}
              slotProps={{ htmlInput: { min: 0, step: "any" } }} />
            <TextField label="Image (facultative)" value={values.image} onChange={change("image")} disabled={busy}
              helperText="Adresse d’image ; une valeur vide est autorisée." />
            <TextField label="Description (facultative)" value={values.description} onChange={change("description")}
              disabled={busy} multiline minRows={3} />
            {editing && <Typography variant="caption" color="text.secondary">
              PUT remplace les cinq champs. Les champs facultatifs vides ne conservent pas leur ancienne valeur.
            </Typography>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose} disabled={busy}>{writeEnabled ? "Annuler" : "Fermer l’aperçu"}</Button>
          <Button type="submit" variant="contained" disabled={!writeEnabled || busy}>
            {busy ? "Enregistrement…" : editing ? "Enregistrer" : "Créer le produit"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
