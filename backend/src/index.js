import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";

import authRoutes from "./routes/auth.js";
import sociosRoutes from "./routes/socios.js";
import ingresosRoutes from "./routes/ingresos.js";
import qrRoutes from "./routes/qr.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Pool global de Postgres
const { Pool } = pkg;
app.locals.pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(cors({ origin: "http://localhost:5173", credentials: false }));
app.use(express.json());

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/socios", sociosRoutes);
app.use("/api/ingresos", ingresosRoutes);
app.use("/api/qr", qrRoutes);

// Ruta de prueba
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Servidor backend funcionando" });
});

// Manejo 404
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Ruta no encontrada" });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
