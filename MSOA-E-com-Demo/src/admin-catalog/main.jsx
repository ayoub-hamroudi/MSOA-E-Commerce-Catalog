import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import AdminCatalogPage from "./AdminCatalogPage";

const theme = createTheme({
  palette: { primary: { main: "#1976d2" }, background: { default: "#f8fafc" } },
  shape: { borderRadius: 12 },
  typography: { fontFamily: 'Roboto, Arial, sans-serif' },
});

createRoot(document.getElementById("admin-catalog-root")).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AdminCatalogPage />
    </ThemeProvider>
  </StrictMode>
);
