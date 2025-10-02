// backend/scripts/dropAll.js
import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const run = async () => {
  try {
    await pool.query(`
      DROP TABLE IF EXISTS ingresos_playa CASCADE;
      DROP TABLE IF EXISTS qr_tags CASCADE;
      DROP TABLE IF EXISTS estacionamiento CASCADE;
      DROP TABLE IF EXISTS no_socios CASCADE;
      DROP TABLE IF EXISTS usuarios CASCADE;
      DROP TABLE IF EXISTS socios CASCADE;
    `);
    console.log("✅ Tablas eliminadas");
  } catch (err) {
    console.error("❌ Error al borrar:", err.message);
  } finally {
    await pool.end();
  }
};

run();
