import express from "express";
import pkg from "pg";
import { verifyToken, requireAdmin } from "../middleware/auth.js";

const { Pool } = pkg;

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** POST /api/qr/link  => { uuid, dni | socio_id }
 *  Crea o actualiza la vinculación de la UUID a un socio
 */
router.post("/link", verifyToken, requireAdmin, async (req, res) => {
  try {
    let { uuid, dni, socio_id } = req.body || {};
    if (!uuid) return res.status(400).json({ ok:false, error: "Falta uuid" });

    // Encontrar socio destino
    let socioId = socio_id;
    if (!socioId && dni) {
      const { rows } = await pool.query("SELECT id FROM socios WHERE dni=$1 LIMIT 1",[dni]);
      if (rows.length === 0) return res.status(404).json({ ok:false, error:"Socio (dni) no encontrado" });
      socioId = rows[0].id;
    }
    if (!socioId) return res.status(400).json({ ok:false, error:"Falta dni o socio_id" });

    // Upsert de la uuid
    const q = `
      INSERT INTO qr_tags (uuid, socio_id, activo)
      VALUES ($1, $2, TRUE)
      ON CONFLICT (uuid)
      DO UPDATE SET socio_id = EXCLUDED.socio_id, activo = TRUE, revoked_at = NULL
      RETURNING id, socio_id, uuid, activo
    `;
    const { rows } = await pool.query(q, [uuid, socioId]);
    return res.json({ ok:true, tag: rows[0] });
  } catch (err) {
    console.error("qr/link error:", err);
    return res.status(500).json({ ok:false, error:"Error vinculando QR" });
  }
});

/** GET /api/qr/resolve/:uuid  => devuelve socio asociado */
router.get("/resolve/:uuid", verifyToken, async (req,res)=>{
  try {
    const { uuid } = req.params;
    const { rows } = await pool.query(
      `SELECT s.id, s.nro_socio, s.dni, s.nombre_completo, s.estado_general
       FROM qr_tags q
       JOIN socios s ON s.id = q.socio_id
       WHERE q.uuid = $1 AND q.activo = TRUE
       LIMIT 1`,
      [uuid]
    );
    if (rows.length === 0) return res.status(404).json({ ok:false, error:"QR no vinculado o inactivo" });
    return res.json({ ok:true, socio: rows[0] });
  } catch (err) {
    console.error("qr/resolve error:", err);
    return res.status(500).json({ ok:false, error:"Error resolviendo QR" });
  }
});

/** POST /api/qr/revoke  => { uuid }  (opcional: para invalidar un QR viejo) */
router.post("/revoke", verifyToken, requireAdmin, async (req,res)=>{
  try {
    const { uuid } = req.body || {};
    if (!uuid) return res.status(400).json({ ok:false, error:"Falta uuid" });
    const { rowCount } = await pool.query(
      "UPDATE qr_tags SET activo=FALSE, revoked_at=NOW() WHERE uuid=$1",
      [uuid]
    );
    if (!rowCount) return res.status(404).json({ ok:false, error:"QR no encontrado" });
    return res.json({ ok:true });
  } catch (err) {
    console.error("qr/revoke error:", err);
    return res.status(500).json({ ok:false, error:"Error revocando QR" });
  }
});

export default router;
