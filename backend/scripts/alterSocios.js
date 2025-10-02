import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const run = async () => {
  try {
    await pool.query("ALTER TABLE socios ADD COLUMN fecha_tope DATE;");
    console.log("✅ Columna fecha_tope agregada");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await pool.end();
  }
};

run();
