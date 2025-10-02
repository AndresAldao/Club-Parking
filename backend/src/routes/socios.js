// import express from "express";
// import multer from "multer";
// import { parse } from "csv-parse";
// import { verifyToken, requireAdmin } from "../middleware/auth.js";

// const router = express.Router();

// // Multer en memoria (acepta cualquier campo)
// const upload = multer({ storage: multer.memoryStorage() }).any();

// // Detectar delimitador ; , o TAB
// function detectarDelimitador(sample) {
//   const head = sample.split(/\r?\n/).slice(0, 10).join("\n");
//   const counts = {
//     "\t": (head.match(/\t/g) || []).length,
//     ";": (head.match(/;/g) || []).length,
//     ",": (head.match(/,/g) || []).length,
//   };
//   return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ";";
// }

// // Extraer campos clave desde una fila heterogénea
// function extraerCampos(row) {
//   const cells = row.map((c) => (c ?? "").toString().trim());

//   const nro_socio = cells[0] || null;
//   const nombre_completo = cells[1] || null;

//   let dni = null;
//   const dniIdx = cells.findIndex((c) => c.toUpperCase() === "DNI");
//   if (dniIdx >= 0 && cells[dniIdx + 1]) dni = cells[dniIdx + 1].replace(/\D/g, "");

//   const estado_candidato = cells.find((c) =>
//     /(ACTIVO|BAJA POR|BAJA|MOROSIDAD|RENUNCIA)/i.test(c)
//   );
//   const estado_general = estado_candidato || null;

//   return { nro_socio, dni, nombre_completo, estado_general };
// }

// /** POST /api/socios/upload (solo admin) — carga CSV */
// router.post("/upload", verifyToken, requireAdmin, upload, async (req, res) => {
//   try {
//     const f = req.files?.[0];
//     if (!f) return res.status(400).json({ error: "Subí un CSV en el campo 'file'" });

//     const csvString = f.buffer.toString("utf8");
//     const delim = detectarDelimitador(csvString);

//     const parser = parse(csvString, {
//       delimiter: delim,
//       bom: true,
//       relax_column_count: true,
//       skip_empty_lines: true,
//       trim: true,
//       relax_quotes: true,
//       quote: '"'
//     });

//     let parserError = null;
//     parser.on("error", (e) => { parserError = e; });

//     const pool = req.app.locals.pool;
//     const client = await pool.connect();

//     let insertados = 0, actualizados = 0, saltados = 0;

//     try {
//       await client.query("BEGIN");

//       for await (const row of parser) {
//         if (parserError) throw parserError;

//         const { nro_socio, dni, nombre_completo, estado_general } = extraerCampos(row);
//         if (!dni || !nombre_completo) { saltados++; continue; }

//         const q = `
//           INSERT INTO socios (nro_socio, dni, nombre_completo, estado_general)
//           VALUES ($1, $2, $3, $4)
//           ON CONFLICT (dni)
//           DO UPDATE SET
//             nro_socio = EXCLUDED.nro_socio,
//             nombre_completo = EXCLUDED.nombre_completo,
//             estado_general = EXCLUDED.estado_general
//           RETURNING (xmax = 0) AS inserted;
//         `;
//         const { rows } = await client.query(q, [nro_socio, dni, nombre_completo, estado_general]);
//         if (rows?.[0]?.inserted) insertados++; else actualizados++;
//       }

//       await client.query("COMMIT");
//       return res.json({ ok: true, resumen: { insertados, actualizados, saltados } });
//     } catch (e) {
//       await client.query("ROLLBACK");
//       return res.status(400).json({ ok: false, error: "CSV inválido o inesperado", detail: e.message });
//     } finally {
//       client.release();
//     }
//   } catch (err) {
//     console.error("Upload socios error:", err);
//     return res.status(500).json({ ok: false, error: "Error procesando CSV", detail: err.message });
//   }
// });

// /** GET /api/socios?page=&limit=&q=... — listado con búsqueda (requiere login) */
// router.get("/", verifyToken, async (req, res) => {
//   try {
//     const page = Math.max(parseInt(req.query.page) || 1, 1);
//     const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
//     const offset = (page - 1) * limit;
//     const q = (req.query.q || "").toString().trim();

//     const pool = req.app.locals.pool;

//     const where = [];
//     const params = [];

//     if (q) {
//       // si son solo dígitos, buscamos por DNI como prefijo; si no, por nombre parcial
//       const soloDigitos = /^\d+$/.test(q);
//       if (soloDigitos) {
//         params.push(`${q}%`);
//         where.push(`dni ILIKE $${params.length}`);
//       } else {
//         params.push(`%${q}%`);
//         where.push(`nombre_completo ILIKE $${params.length}`);
//       }
//     }

//     const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

//     const countSql = `SELECT COUNT(*) AS total FROM socios ${whereSql}`;
//     const count = await pool.query(countSql, params);
//     const total = parseInt(count.rows[0].total, 10) || 0;

//     params.push(limit, offset);
//     const dataSql = `
//       SELECT id, nro_socio, dni, nombre_completo, estado_general
//       FROM socios
//       ${whereSql}
//       ORDER BY id ASC
//       LIMIT $${params.length - 1} OFFSET $${params.length}
//     `;
//     const { rows } = await pool.query(dataSql, params);

//     res.json({
//       ok: true,
//       page,
//       limit,
//       total,
//       totalPages: Math.max(1, Math.ceil(total / limit)),
//       socios: rows
//     });
//   } catch (err) {
//     console.error("Error listando socios:", err);
//     res.status(500).json({ ok: false, error: "Error al listar socios" });
//   }
// });


// /** GET /api/socios/:dni — búsqueda por DNI (requiere login) */
// router.get("/:dni", verifyToken, async (req, res) => {
//   try {
//     const { dni } = req.params;
//     const pool = req.app.locals.pool;

//     const { rows } = await pool.query(
//       "SELECT id, nro_socio, dni, nombre_completo, estado_general FROM socios WHERE dni = $1",
//       [dni]
//     );
//     if (rows.length === 0) return res.status(404).json({ ok: false, message: "Socio no encontrado" });

//     res.json({ ok: true, socio: rows[0] });
//   } catch (err) {
//     console.error("Error buscando socio:", err);
//     res.status(500).json({ ok: false, error: "Error al buscar socio" });
//   }
// });

// export default router;


// routes/socios.js

import express from "express";
import multer from "multer";
import { parse } from "csv-parse";
import { verifyToken, requireAdmin } from "../middleware/auth.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }).any();

/** 👇 columnas existentes en la tabla `socios` */
const allowedCols = new Set([
  "nro_socio",
  "apellido_nombre",
  "fecha_nac",
  "edad",
  "ant_fecha_alta",
  "fecha_alta",
  "sexo",
  "categoria",
  "estado_general",
  "fecha_tope",
  "fecha_baja",
  "tipo_socio",
  "grupo_fliar",
  "titular",
  "tipo_doc",
  "documento",
  "domicilio",
  "telefono",
  "celular",
  "email",
  "ciudad",
  "cp",
  "provincia",
  "pais",
  "ultima_fecha_pago",
]);

/** normaliza encabezados: minúsculas, sin tildes, sin puntos, sin dobles espacios */
function normHeader(h) {
  return (h ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[./]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** mapeo de encabezados → columnas reales */
const headerMap = {
  "nro socio": "nro_socio",
  "nro.socio": "nro_socio",
  "nro  socio": "nro_socio",
  "numero de socio": "nro_socio",

  "apellidonombre": "apellido_nombre",
  "apellido nombre": "apellido_nombre",
  "apellido y nombre": "apellido_nombre",

  "fecha nac": "fecha_nac",
  "fecha nac.": "fecha_nac",

  "edad": "edad",

  "ant fecha alta": "ant_fecha_alta",

  "fecha alta": "fecha_alta",

  "sexo": "sexo",

  "categoria": "categoria",

  "estado": "estado_general",

  "fecha tope": "fecha_tope",
  "fecha tope habilitacion": "fecha_tope",

  "fecha baja": "fecha_baja",

  "tipo socio": "tipo_socio",
  "tiposocio": "tipo_socio",

  "grupo fliar": "grupo_fliar",

  "titular": "titular",

  "tipo doc": "tipo_doc",
  "tipo doc.": "tipo_doc",

  // Documento / DNI
  "documento": "documento",
  "dni": "documento",
  "nro doc": "documento",
  "n° doc": "documento",
  "numero documento": "documento",

  "domicilio": "domicilio",
  "telefono": "telefono",
  "teléfono": "telefono",
  "celular": "celular",
  "email": "email",
  "ciudad": "ciudad",
  "cp": "cp",
  "provincia": "provincia",
  "pais": "pais",

  "ultima fecha pago": "ultima_fecha_pago",
  "ultima fecha de pago": "ultima_fecha_pago",
};

function detectarDelimitador(sample) {
  const head = sample.split(/\r?\n/).slice(0, 10).join("\n");
  const counts = {
    "\t": (head.match(/\t/g) || []).length,
    ";": (head.match(/;/g) || []).length,
    ",": (head.match(/,/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || ";";
}

/** Detecta la línea donde empiezan los headers reales (salta títulos como "SOCIOS ORDENADOS") */
function detectarLineaHeader(csvString, delim) {
  const lines = csvString.split(/\r?\n/);
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const cells = lines[i].split(delim).map((s) => normHeader(s));
    const hayDoc = cells.some((h) =>
      ["dni", "documento", "nro doc", "n° doc", "numero documento"].includes(h)
    );
    const hayNombre = cells.some((h) =>
      ["apellido nombre", "apellido y nombre", "apellidonombre"].includes(h)
    );
    const haySocio = cells.some((h) =>
      ["nro socio", "nro  socio", "nro.socio", "numero de socio"].includes(h)
    );
    if ((hayDoc && hayNombre) || (hayDoc && haySocio)) {
      return i + 1; // csv-parse usa 1-based
    }
  }
  return 1; // fallback
}

function normalizarFecha(val) {
  if (!val) return null;
  const s = String(val).trim();
  const parts = s.split(/[\/\-]/);
  if (parts.length !== 3) return null;
  let [d, m, y] = parts.map((p) => p.trim());
  if (y.length === 2) y = `20${y}`;
  if (!/^\d{1,2}$/.test(d) || !/^\d{1,2}$/.test(m) || !/^\d{4}$/.test(y)) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// (opcional) convertir serial de Excel a ISO
function excelSerialToISO(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 25569) return null; // 1970-01-01 ~ 25569
  const ms = (num - 25569) * 86400 * 1000;
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toDateOrNull(v) {
  const s = (v ?? "").toString().trim();
  if (s === "" || s === "-" || s === "0") return null;

  // Intento 1: dd/mm/yyyy o dd-mm-yyyy
  const norm = normalizarFecha(s);
  if (norm) return norm;

  // Intento 2: 8 dígitos → asumimos ddmmyyyy
  if (/^\d{8}$/.test(s)) {
    const d = s.slice(0, 2), m = s.slice(2, 4), y = s.slice(4, 8);
    if (+d >= 1 && +d <= 31 && +m >= 1 && +m <= 12) {
      return `${y}-${m}-${d}`;
    }
  }

  // Intento 3: serial Excel
  const excel = excelSerialToISO(s);
  if (excel) return excel;

  // Nada funcionó → NULL para no romper el INSERT
  return null;
}

/** ===========================
 *  POST /api/socios/upload
 *  =========================== */
router.post("/upload", verifyToken, requireAdmin, upload, async (req, res) => {
  try {
    const f = req.files?.[0];
    const debug = req.query.debug === "1";
    if (!f) {
      return res
        .status(400)
        .json({ ok: false, error: "Subí un CSV en el campo 'file' (form-data)" });
    }

    // Encoding: primero probamos utf8. Si ves � en ñ/acentos, podés cambiar a "latin1".
    let csvString = f.buffer.toString("utf8");
    const delim = detectarDelimitador(csvString);
    const fromLine = detectarLineaHeader(csvString, delim);

    const parser = parse(csvString, {
      delimiter: delim,
      bom: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      quote: '"',
      from_line: fromLine, // 👈 salta filas previas a los headers reales
    });

    let headersRaw = [];
    let headersNorm = [];
    let headersMapped = [];
    let parserError = null;

    parser.on("error", (e) => { parserError = e; });

    const pool = req.app.locals.pool;
    if (!pool) {
      return res.status(500).json({
        ok: false,
        error: "Pool de base de datos no inicializado (app.locals.pool)",
      });
    }
    const client = await pool.connect();

    let insertados = 0, actualizados = 0, saltados = 0;
    const ejemplos = [];
    let rowIndex = 0;
    let txStarted = false;

    try {
      await client.query("BEGIN");
      txStarted = true;

      for await (const row of parser) {
        if (parserError) throw parserError;
        rowIndex++;

        if (rowIndex === 1) {
          headersRaw = row.slice();
          headersNorm = row.map(normHeader);
          headersMapped = headersNorm.map((h) => headerMap[h] || null);

          // Si ningún header mapeó, heurística mínima
          if (headersMapped.every((h) => h === null)) {
            headersMapped = headersNorm.map(() => null);
            if (headersMapped.length > 0) headersMapped[0] = "nro_socio";
            if (headersMapped.length > 1) headersMapped[1] = "apellido_nombre";
            const dniIdx = headersNorm.findIndex((h) => h === "dni" || h === "documento");
            if (dniIdx >= 0) headersMapped[dniIdx] = "documento";
          }

          // Validación: doc + (apellido_nombre o nro_socio)
          const tieneDoc = headersMapped.includes("documento");
          const tieneNombre = headersMapped.includes("apellido_nombre");
          const tieneNroSocio = headersMapped.includes("nro_socio");
          if (!tieneDoc || (!tieneNombre && !tieneNroSocio)) {
            return res.status(400).json({
              ok: false,
              error:
                "Encabezados inválidos: se requiere al menos DNI/Documento y (Apellido y Nombre o Nro Socio).",
              debug: debug
                ? { delimitador: delim, fromLine, headersRaw, headersNorm, headersMapped }
                : undefined,
            });
          }
          continue;
        }

        // Construir record SOLO con columnas permitidas
        const raw = {};
        headersMapped.forEach((col, i) => {
          if (!col) return;
          const val = row[i] ?? null;
          if (allowedCols.has(col)) raw[col] = val === "" ? null : val;
        });

        // Documento obligatorio (limpio)
        let documento = raw.documento ? String(raw.documento).replace(/\D/g, "") : null;
        if (!documento) {
          const dniIdx = headersNorm.findIndex((h) => h === "dni");
          if (dniIdx >= 0 && row[dniIdx] != null) {
            const val = String(row[dniIdx]).replace(/\D/g, "");
            if (val) documento = val;
          }
        }
        if (!documento) {
          saltados++;
          if (debug && ejemplos.length < 3) ejemplos.push({ tipo: "saltado_sin_documento", row });
          continue;
        }
        raw.documento = documento;

        // Normalizar fechas → NULL si inválidas
        for (const f of ["fecha_nac", "ant_fecha_alta", "fecha_alta", "fecha_tope", "fecha_baja", "ultima_fecha_pago"]) {
          if (f in raw) raw[f] = toDateOrNull(raw[f]);
        }

        // Upsert mínimo (si solo viene documento, igual crea base)
        const cols = Object.keys(raw);
        const vals = Object.values(raw);
        const placeholders = cols.map((_, i) => `$${i + 1}`);
        const updateSet = cols.map((c) => `${c} = EXCLUDED.${c}`).join(", ");

        const q = `
          INSERT INTO socios (${cols.join(",")})
          VALUES (${placeholders.join(",")})
          ON CONFLICT (documento)
          DO UPDATE SET ${updateSet}
          RETURNING (xmax = 0) AS inserted;
        `;
        const { rows } = await client.query(q, vals);
        if (rows?.[0]?.inserted) insertados++; else actualizados++;

        if (debug && ejemplos.length < 3) ejemplos.push({
          tipo: rows?.[0]?.inserted ? "insertado" : "actualizado",
          raw,
        });
      }

      await client.query("COMMIT");

      if (debug) {
        return res.json({
          ok: true,
          debug: {
            delimitador: delim === "\t" ? "TAB" : delim,
            fromLine,
            headersRaw,
            headersNorm,
            headersMapped,
            ejemplos,
          },
          resumen: { insertados, actualizados, saltados },
        });
      }

      return res.json({ ok: true, resumen: { insertados, actualizados, saltados } });
    } catch (e) {
      if (txStarted) await client.query("ROLLBACK");
      return res.status(400).json({ ok: false, error: "CSV inválido", detail: e.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Upload socios error:", err);
    return res.status(500).json({ ok: false, error: "Error procesando CSV", detail: err.message });
  }
});

// --------------------
// 📌 Listado de socios (paginado + búsqueda) — usa vista socios_api
// --------------------
router.get("/", verifyToken, async (req, res) => {
  try {
    const { search } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const offset = (page - 1) * limit;

    const pool = req.app.locals.pool;
    if (!pool) {
      return res.status(500).json({
        ok: false,
        error: "Pool de base de datos no inicializado (app.locals.pool)",
      });
    }

    const where = [];
    const params = [];

    if (search) {
      params.push(`%${String(search).toLowerCase().trim()}%`);
      where.push(`(LOWER(apellido_nombre) LIKE $${params.length}
                  OR documento LIKE $${params.length}
                  OR nro_socio LIKE $${params.length})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const count = await pool.query(
      `SELECT COUNT(*) AS total FROM socios_api ${whereSql}`,
      params
    );
    const total = parseInt(count.rows[0].total, 10);

    params.push(limit, offset);
    const data = await pool.query(
      `SELECT *
       FROM socios_api
       ${whereSql}
       ORDER BY id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      ok: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      socios: data.rows, // fechas ya vienen formateadas o ""
    });
  } catch (err) {
    console.error("Error listando socios:", err);
    res.status(500).json({ ok: false, error: "Error al listar socios" });
  }
});

// --------------------
// 📌 Buscar por documento — usa vista socios_api
// --------------------
router.get("/:documento", verifyToken, async (req, res) => {
  try {
    const { documento } = req.params;
    const pool = req.app.locals.pool;
    if (!pool) {
      return res.status(500).json({
        ok: false,
        error: "Pool de base de datos no inicializado (app.locals.pool)",
      });
    }

    const { rows } = await pool.query(
      `SELECT *
       FROM socios_api
       WHERE documento = $1`,
      [String(documento).replace(/\D/g, "")]
    );

    if (!rows.length)
      return res.status(404).json({ ok: false, message: "Socio no encontrado" });
    res.json({ ok: true, socio: rows[0] });
  } catch (err) {
    console.error("Error buscando socio:", err);
    res.status(500).json({ ok: false, error: "Error al buscar socio" });
  }
});




export default router;
