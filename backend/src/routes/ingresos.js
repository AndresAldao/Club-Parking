import express from "express";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

/** Intenta extraer documento (DNI) o nro_socio desde string QR (texto o JSON) */
function parseQR(qrData) {
  if (!qrData) return {};
  try {
    const obj = JSON.parse(qrData);
    return {
      documento: (obj.documento || obj.dni || obj.DNI || "")
        .toString()
        .replace(/\D/g, "") || undefined,
      nro_socio: (obj.nro_socio || obj.socio || "").toString() || undefined,
    };
  } catch {
    const txt = String(qrData).trim();
    if (/^\d{7,9}$/.test(txt)) return { documento: txt };       // DNI
    if (/^\d{5,12}$/.test(txt)) return { nro_socio: txt };       // Nro socio
    const dniMatch = txt.match(/(?:dni|documento)[:=\s"]+(\d{7,9})/i);
    const socioMatch = txt.match(/(nro_?socio|socio)[:=\s"]+(\d{5,12})/i);
    return { documento: dniMatch?.[1], nro_socio: socioMatch?.[2] };
  }
}

/** ✅ Validación: sólo ACTIVO o VITALICIO */
function validarHabilitacion(socio) {
  const estado = (socio?.estado_general || "").toString().trim().toUpperCase();
  const tipo = (socio?.tipo_socio || "").toString().trim().toUpperCase();
  if (tipo.includes("VITALICIO")) return null;
  if (estado === "ACTIVO") return null;
  return "El socio no está activo";
}

function saneaTipoAcceso(val) {
  const s = String(val || "").trim().toLowerCase();
  if (!s) return null;
  const allowed = new Set(["auto", "moto", "bici", "peaton", "peatón", "otro"]);
  return allowed.has(s) ? (s === "peatón" ? "peaton" : s) : "otro";
}

function saneaObservacion(val) {
  const s = String(val || "").trim();
  return s || null;
}

/** POST /api/ingresos/qr — registrar ingreso de socio desde QR (texto con documento/nro_socio) */
router.post("/qr", verifyToken, async (req, res) => {
  try {
    const { qrData, validado_por, tipo_acceso, observacion, patente } = req.body || {};
    if (!qrData || !validado_por) {
      return res.status(400).json({ ok: false, error: "Faltan qrData o validado_por" });
    }

    const { documento, nro_socio } = parseQR(qrData);
    if (!documento && !nro_socio) {
      return res.status(400).json({ ok: false, error: "No se pudo extraer documento/nro_socio del QR" });
    }

    const pool = req.app.locals.pool;

    const { rows } = await pool.query(
      `SELECT id, nro_socio, documento, apellido_nombre, estado_general, tipo_socio
       FROM socios
       WHERE ($1::text IS NOT NULL AND documento = $1) OR ($2::text IS NOT NULL AND nro_socio = $2)
       LIMIT 1`,
      [documento || null, nro_socio || null]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: "Socio no encontrado por QR" });

    const socio = rows[0];

    // ✅ Validaciones actualizadas
    const motivoBloqueo = validarHabilitacion(socio);
    if (motivoBloqueo) {
      return res.status(403).json({ ok: false, error: motivoBloqueo });
    }

    const tAcc = saneaTipoAcceso(tipo_acceso);
    const obs = saneaObservacion(observacion);
    const pat = patente ? String(patente).trim().toUpperCase() : null;

    await pool.query(
      `INSERT INTO ingresos_playa (socio_id, tipo_ingreso, validado_por, tipo_acceso, patente, observacion)
       VALUES ($1, 'socio', $2, $3, $4, $5)`,
      [socio.id, String(validado_por).trim(), tAcc, pat, obs]
    );

    res.json({
      ok: true,
      message: "Ingreso de socio registrado por QR",
      socio: {
        id: socio.id,
        nro_socio: socio.nro_socio,
        documento: socio.documento,
        dni: socio.documento,
        nombre_completo: socio.apellido_nombre,
        estado_general: socio.estado_general,
        tipo_socio: socio.tipo_socio
      },
      tipo_acceso: tAcc || "",
      observacion: obs || "",
      patente: pat || ""
    });
  } catch (err) {
    console.error("QR ingreso error:", err);
    res.status(500).json({ ok: false, error: "Error registrando ingreso por QR" });
  }
});

/** POST /api/ingresos/qr-uuid — registrar ingreso de socio desde UUID */
router.post("/qr-uuid", verifyToken, async (req, res) => {
  try {
    const { uuid, validado_por, tipo_acceso, observacion, patente } = req.body || {};
    if (!uuid || !validado_por) return res.status(400).json({ ok:false, error:"Faltan uuid o validado_por" });

    const pool = req.app.locals.pool;

    const { rows } = await pool.query(
      `SELECT s.id, s.nro_socio, s.documento, s.apellido_nombre, s.estado_general, s.tipo_socio
       FROM qr_tags q
       JOIN socios s ON s.id = q.socio_id
       WHERE q.uuid = $1 AND q.activo = TRUE
       LIMIT 1`,
      [uuid]
    );
    if (!rows.length) {
      return res.status(404).json({ ok:false, code:"UNMAPPED_UUID", error:"QR no vinculado o inactivo" });
    }

    const socio = rows[0];

    // ✅ Validaciones actualizadas
    const motivoBloqueo = validarHabilitacion(socio);
    if (motivoBloqueo) {
      return res.status(403).json({ ok: false, error: motivoBloqueo });
    }

    const tAcc = saneaTipoAcceso(tipo_acceso);
    const obs = saneaObservacion(observacion);
    const pat = patente ? String(patente).trim().toUpperCase() : null;

    await pool.query(
      `INSERT INTO ingresos_playa (socio_id, tipo_ingreso, validado_por, tipo_acceso, patente, observacion)
       VALUES ($1, 'socio', $2, $3, $4, $5)`,
      [socio.id, String(validado_por).trim(), tAcc, pat, obs]
    );

    res.json({
      ok:true,
      message:"Ingreso registrado por UUID",
      socio: {
        id: socio.id,
        nro_socio: socio.nro_socio,
        documento: socio.documento,
        dni: socio.documento,
        nombre_completo: socio.apellido_nombre,
        estado_general: socio.estado_general,
        tipo_socio: socio.tipo_socio
      },
      tipo_acceso: tAcc || "",
      observacion: obs || "",
      patente: pat || ""
    });
  } catch (err) {
    console.error("qr-uuid ingreso error:", err);
    res.status(500).json({ ok:false, error:"Error registrando ingreso por UUID" });
  }
});

/** POST /api/ingresos/visitante — registrar ingreso de no socio */
router.post("/visitante", verifyToken, async (req, res) => {
  try {
    const { nombre_completo, dni, validado_por, tipo_acceso, observacion, patente } = req.body || {};
    if (!validado_por) return res.status(400).json({ ok:false, error:"Falta validado_por" });

    const dniNum = dni ? String(dni).replace(/\D/g, "") : null;
    const pool = req.app.locals.pool;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let noSocioId;
      if (dniNum) {
        const { rows: exist } = await client.query("SELECT id FROM no_socios WHERE dni=$1 LIMIT 1", [dniNum]);
        if (exist.length) {
          noSocioId = exist[0].id;
          if (nombre_completo) {
            await client.query("UPDATE no_socios SET nombre_completo = $1 WHERE id = $2", [String(nombre_completo).trim(), noSocioId]);
          }
        } else {
          const { rows: created } = await client.query(
            "INSERT INTO no_socios (dni, nombre_completo) VALUES ($1, $2) RETURNING id",
            [dniNum, nombre_completo ? String(nombre_completo).trim() : null]
          );
          noSocioId = created[0].id;
        }
      } else {
        const { rows: created } = await client.query(
          "INSERT INTO no_socios (dni, nombre_completo) VALUES ($1, $2) RETURNING id",
          [null, nombre_completo ? String(nombre_completo).trim() : null]
        );
        noSocioId = created[0].id;
      }

      const tAcc = saneaTipoAcceso(tipo_acceso);
      const obs = saneaObservacion(observacion);
      const pat = patente ? String(patente).trim().toUpperCase() : null;

      await client.query(
        `INSERT INTO ingresos_playa (no_socio_id, tipo_ingreso, validado_por, tipo_acceso, patente, observacion)
         VALUES ($1, 'no_socio', $2, $3, $4, $5)`,
        [noSocioId, String(validado_por).trim(), tAcc, pat, obs]
      );

      await client.query("COMMIT");
      res.json({
        ok:true,
        message:"Ingreso de visitante registrado",
        visitante: { id: noSocioId, dni: dniNum, nombre_completo: nombre_completo || null },
        tipo_acceso: tAcc || "",
        observacion: obs || "",
        patente: pat || ""
      });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Visitante ingreso error:", err);
    res.status(500).json({ ok:false, error:"Error registrando ingreso de visitante" });
  }
});

/** GET /api/ingresos — filtros + paginación */
/** GET /api/ingresos — filtros + paginación */
router.get("/", verifyToken, async (req, res) => {
  try {
    const { desde, hasta, tipo, estado_pago } = req.query;
    const dniExacto = req.query.dni;          // match exacto (compatibilidad)
    const dniLike = req.query.dni_like;       // match parcial por DNI
    const nombreLike = req.query.nombre;      // match parcial por nombre

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];

    if (desde) { params.push(desde); where.push(`i.fecha_ingreso >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); where.push(`i.fecha_ingreso < ($${params.length}::date + INTERVAL '1 day')`); }

    if (tipo === "socio" || tipo === "no_socio") {
      params.push(tipo);
      where.push(`i.tipo_ingreso = $${params.length}`);
    }

    // DNI parcial (dni_like) tiene prioridad sobre dni exacto
    if (dniLike) {
      params.push(`%${String(dniLike)}%`);
      where.push(`(s.documento::text ILIKE $${params.length} OR ns.dni::text ILIKE $${params.length})`);
    } else if (dniExacto) {
      params.push(String(dniExacto));
      where.push(`(s.documento = $${params.length} OR ns.dni = $${params.length})`);
    }

    // Nombre parcial
    if (nombreLike) {
      params.push(`%${String(nombreLike)}%`);
      where.push(`(s.apellido_nombre ILIKE $${params.length} OR ns.nombre_completo ILIKE $${params.length})`);
    }

    if (estado_pago) {
      params.push(String(estado_pago));
      where.push(`i.estado_pago = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const baseSelect = `
      FROM ingresos_playa i
      LEFT JOIN socios s ON s.id = i.socio_id
      LEFT JOIN no_socios ns ON ns.id = i.no_socio_id
      ${whereSql}
    `;

    const pool = req.app.locals.pool;

    const countRows = await pool.query(`SELECT COUNT(*) AS total ${baseSelect}`, params);
    const total = parseInt(countRows.rows[0].total, 10);

    params.push(limit, offset);
    const qData = `
      SELECT
        i.id, i.tipo_ingreso, i.fecha_ingreso, i.validado_por,
        i.tipo_acceso, i.patente, i.observacion, i.estado_pago,
        s.id AS socio_id,
        s.documento AS socio_documento,
        s.nro_socio,
        s.apellido_nombre AS socio_nombre,
        s.estado_general AS socio_estado,
        s.tipo_socio AS socio_tipo,
        ns.id AS no_socio_id, ns.dni AS no_socio_dni, ns.nombre_completo AS no_socio_nombre
      ${baseSelect}
      ORDER BY i.fecha_ingreso DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const dataRows = await pool.query(qData, params);

    res.json({
      ok: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      ingresos: dataRows.rows.map(r => ({
        id: r.id,
        tipo_ingreso: r.tipo_ingreso,
        fecha_ingreso: new Date(r.fecha_ingreso).toLocaleString("es-AR", {
          timeZone: "America/Argentina/Buenos_Aires",
          hour12: false
        }),
        validado_por: r.validado_por,
        tipo_acceso: r.tipo_acceso || "",
        observacion: r.observacion || "",
        patente: r.patente || "",
        estado_pago: r.estado_pago || "pendiente",
        socio: r.socio_id ? {
          id: r.socio_id,
          documento: r.socio_documento,
          dni: r.socio_documento,
          nro_socio: r.nro_socio,
          nombre_completo: r.socio_nombre,
          estado_general: r.socio_estado,
          tipo_socio: r.socio_tipo
        } : null,
        no_socio: r.no_socio_id ? {
          id: r.no_socio_id,
          dni: r.no_socio_dni,
          nombre_completo: r.no_socio_nombre
        } : null
      }))
    });
  } catch (err) {
    console.error("Error listando ingresos:", err);
    res.status(500).json({ ok: false, error: "Error al listar ingresos" });
  }
});


/** ✅ PATCH /api/ingresos/:id/estado-pago — actualizar estado_pago */
router.patch("/:id/estado-pago", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    let raw = String(req.body?.estado_pago || "").trim().toLowerCase();

    // Normalización (acepta variantes con espacios o guiones)
    const norm = raw
      .replace(/\s+/g, "_")
      .replace(/-+/g, "_");

    const map = {
      pendiente: "pendiente",
      pago: "pago",
      abonado_mensual: "abonado_mensual",
      "abonado_mensual": "abonado_mensual",
      abonado_anual: "abonado_anual",
      "abonado_anual": "abonado_anual",
      exento: "exento"
    };

    // También aceptar labels "humanos"
    if (norm === "abonado_mensual" || norm === "abonado_mensual") raw = "abonado_mensual";
    if (norm === "abonado_anual" || norm === "abonado_anual") raw = "abonado_anual";

    const estado = map[norm] || map[raw] || null;
    if (!estado) {
      return res.status(400).json({ ok: false, error: "estado_pago inválido" });
    }

    const pool = req.app.locals.pool;
    const { rows } = await pool.query(
      `UPDATE ingresos_playa
       SET estado_pago = $1
       WHERE id = $2
       RETURNING id, estado_pago`,
      [estado, id]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: "Ingreso no encontrado" });
    }

    res.json({ ok: true, id: rows[0].id, estado_pago: rows[0].estado_pago });
  } catch (err) {
    console.error("Error actualizando estado_pago:", err);
    res.status(500).json({ ok: false, error: "Error actualizando estado de pago" });
  }
});

export default router;
