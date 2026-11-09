import {
  Avatar, Box, Button, Chip, CircularProgress, IconButton, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography,
} from "@mui/material";
import { DeleteOutlined, EditOutlined, ImageOutlined, VisibilityOutlined } from "@mui/icons-material";

function imageUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export default function ProductAdminTable({ products, loading, writeEnabled, onEdit, onDelete, onPreview }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, overflowX: "auto" }}>
      <Table aria-label="Catalogue des produits administrables" sx={{ minWidth: 1020 }}>
        <TableHead sx={{ bgcolor: "#f1f5f9" }}>
          <TableRow>
            {["ID", "Nom", "Catégorie", "Prix", "Image", "Description", "Actions"].map((label) =>
              <TableCell key={label} sx={{ fontWeight: 700 }}>{label}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}>
              <CircularProgress size={28} aria-label="Chargement du catalogue" />
              <Typography sx={{ mt: 1 }} color="text.secondary">Chargement des produits…</Typography>
            </TableCell></TableRow>
          ) : products.length === 0 ? (
            <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}>
              <Typography fontWeight={600}>Aucun produit à afficher</Typography>
              <Typography variant="body2" color="text.secondary">Essayez une autre recherche ou réinitialisez les filtres.</Typography>
            </TableCell></TableRow>
          ) : products.map((product) => (
            <TableRow key={product.id} hover>
              <TableCell sx={{ color: "text.secondary" }}>#{product.id}</TableCell>
              <TableCell><Typography variant="body2" fontWeight={700}>{product.name}</Typography></TableCell>
              <TableCell><Chip label={product.category} size="small" variant="outlined" /></TableCell>
              <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                {Number(product.price).toLocaleString("fr-FR", { maximumFractionDigits: 20 })}
              </TableCell>
              <TableCell>
                <Tooltip title={product.image || "Aucune image"}>
                  <Avatar src={imageUrl(product.image)} alt={product.name} variant="rounded"
                    slotProps={{ img: { referrerPolicy: "no-referrer" } }} sx={{ width: 56, height: 44, bgcolor: "#f1f5f9" }}>
                    <ImageOutlined color="disabled" />
                  </Avatar>
                </Tooltip>
              </TableCell>
              <TableCell sx={{ minWidth: 200, maxWidth: 300, overflowWrap: "anywhere" }}>
                <Typography variant="body2" color="text.secondary">{product.description || "—"}</Typography>
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  <Button size="small" startIcon={<VisibilityOutlined />} onClick={() => onPreview(product)}>Aperçu</Button>
                  <Tooltip title={writeEnabled ? "Modifier le produit" : "Authentification ADMIN réelle requise"}>
                    <Box component="span"><IconButton aria-label={`Modifier ${product.name}`} disabled={!writeEnabled}
                      onClick={() => onEdit(product)}><EditOutlined fontSize="small" /></IconButton></Box>
                  </Tooltip>
                  <Tooltip title={writeEnabled ? "Supprimer le produit" : "Authentification ADMIN réelle requise"}>
                    <Box component="span"><IconButton aria-label={`Supprimer ${product.name}`} color="error" disabled={!writeEnabled}
                      onClick={() => onDelete(product)}><DeleteOutlined fontSize="small" /></IconButton></Box>
                  </Tooltip>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
