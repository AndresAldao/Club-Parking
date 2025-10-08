import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log("✅ Conectado a Postgres correctamente");
    const result = await client.query("SELECT NOW() as fecha");
    console.log("Hora actual en la DB:", result.rows[0].fecha);
    client.release();
  } catch (err) {
    console.error("❌ Error conectando a Postgres:", err);
  } finally {
    process.exit();
  }
}

testConnection();
