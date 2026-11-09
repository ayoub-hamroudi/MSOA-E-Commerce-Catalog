import { useState } from "react";
import { Alert, Box, Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { FilterAltOffOutlined, SearchOutlined } from "@mui/icons-material";

export default function ProductFilters({ onApply, busy }) {
  const empty = { search: "", category: "", minPrice: "", maxPrice: "", sort: "", direction: "asc" };
  const [values, setValues] = useState(empty);
  const [error, setError] = useState("");
  const change = (name) => (event) => {
    const value = event.target.value;
    setValues((current) => ({ ...current, [name]: value,
      ...(name === "sort" && !value ? { direction: "asc" } : {}) }));
    setError("");
  };

  function submit(event) {
    event.preventDefault();
    for (const name of ["minPrice", "maxPrice"]) {
      if (values[name] !== "" && (!Number.isFinite(Number(values[name])) || Number(values[name]) < 0)) {
        setError("Les prix doivent être des nombres positifs ou nuls.");
        return;
      }
    }
    if (values.minPrice !== "" && values.maxPrice !== "" &&
        Number(values.minPrice) > Number(values.maxPrice)) {
      setError("Le prix minimum doit être inférieur ou égal au maximum.");
      return;
    }
    onApply({ ...values });
  }

  return (
    <Paper component="section" variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
      <Typography component="h2" variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
        Rechercher et filtrer
      </Typography>
      <Box component="form" onSubmit={submit}>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "2fr 1.4fr 1fr 1fr 1fr 1fr" } }}>
          <TextField label="Nom ou description" value={values.search} onChange={change("search")} size="small" />
          <TextField label="Catégorie exacte" value={values.category} onChange={change("category")} size="small" />
          <TextField label="Prix minimum" type="number" value={values.minPrice} onChange={change("minPrice")}
            slotProps={{ htmlInput: { min: 0, step: "any" } }} size="small" />
          <TextField label="Prix maximum" type="number" value={values.maxPrice} onChange={change("maxPrice")}
            slotProps={{ htmlInput: { min: 0, step: "any" } }} size="small" />
          <TextField select label="Trier par" value={values.sort} onChange={change("sort")} size="small">
            <MenuItem value="">ID (défaut)</MenuItem><MenuItem value="name">Nom</MenuItem><MenuItem value="price">Prix</MenuItem>
          </TextField>
          <TextField select label="Ordre" value={values.direction} onChange={change("direction")}
            disabled={!values.sort} size="small">
            <MenuItem value="asc">Croissant</MenuItem><MenuItem value="desc">Décroissant</MenuItem>
          </TextField>
        </Box>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
          <Button type="submit" variant="contained" startIcon={<SearchOutlined />} disabled={busy}>Appliquer</Button>
          <Button startIcon={<FilterAltOffOutlined />} disabled={busy} onClick={() => {
            setValues(empty); setError(""); onApply({});
          }}>Réinitialiser</Button>
        </Stack>
      </Box>
    </Paper>
  );
}
