// scripts/createAdmin.js
import pkg from "pg";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const createAdmin = async () => {
  const username = "admin";
  const password = "admin123"; // 🔑 cambia esto después por seguridad
  const role = "admin";

  try {
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO usuarios (username, password_hash, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (username) DO NOTHING`,
      [username, hash, role]
    );

    console.log(`✅ Usuario admin creado con username: ${username}, password: ${password}`);
  } catch (err) {
    console.error("❌ Error creando admin:", err);
  } finally {
    await pool.end();
  }
};

createAdmin();
