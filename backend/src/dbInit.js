import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// Si tu proveedor requiere SSL, podés usar:
// const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const createTables = async () => {
  try {
    await pool.query(`
      -- =========================
      -- Tablas base
      -- =========================
      CREATE TABLE IF NOT EXISTS socios (
        id SERIAL PRIMARY KEY,
        nro_socio           VARCHAR(50),
        apellido_nombre     VARCHAR(255),
        fecha_nac           DATE,
        edad                INT,
        ant_fecha_alta      DATE,
        fecha_alta          DATE,
        sexo                VARCHAR(10),
        categoria           VARCHAR(100),
        estado_general      VARCHAR(100),
        fecha_tope          DATE,
        fecha_baja          DATE,
        tipo_socio          VARCHAR(100),
        grupo_fliar         VARCHAR(100),
        titular             VARCHAR(255),
        tipo_doc            VARCHAR(50),
        documento           VARCHAR(20),
        domicilio           VARCHAR(255),
        telefono            VARCHAR(100),
        celular             VARCHAR(100),
        email               VARCHAR(200),
        ciudad              VARCHAR(100),
        cp                  VARCHAR(20),
        provincia           VARCHAR(100),
        pais                VARCHAR(100),
        ultima_fecha_pago   DATE,
        CONSTRAINT socios_doc_uq UNIQUE (documento)
      );

      CREATE TABLE IF NOT EXISTS no_socios (
        id SERIAL PRIMARY KEY,
        dni VARCHAR(20),
        nombre_completo VARCHAR(255)
      );

      CREATE TABLE IF NOT EXISTS estacionamiento (
        id SERIAL PRIMARY KEY,
        socio_id INT REFERENCES socios(id) ON DELETE CASCADE,
        tipo_acceso VARCHAR(50),
        fecha_inicio DATE,
        fecha_fin DATE
      );

      CREATE TABLE IF NOT EXISTS ingresos_playa (
        id SERIAL PRIMARY KEY,
        socio_id INT REFERENCES socios(id) ON DELETE CASCADE,
        no_socio_id INT REFERENCES no_socios(id) ON DELETE CASCADE,
        tipo_ingreso VARCHAR(20) NOT NULL, -- 'socio' | 'no_socio'
        fecha_ingreso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        validado_por VARCHAR(100)
      );

      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'empleado',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS qr_tags (
        id SERIAL PRIMARY KEY,
        socio_id INT REFERENCES socios(id) ON DELETE CASCADE,
        uuid UUID UNIQUE NOT NULL,
        activo BOOLEAN NOT NULL DEFAULT TRUE
      );

      -- =========================
      -- Índices (evitamos redundantes)
      -- =========================
      CREATE INDEX IF NOT EXISTS idx_socios_nombre ON socios(apellido_nombre);
      CREATE INDEX IF NOT EXISTS idx_socios_estado ON socios(estado_general);

      -- =========================
      -- Migraciones suaves: nuevos campos en ingresos_playa
      -- =========================
      ALTER TABLE ingresos_playa
        ADD COLUMN IF NOT EXISTS tipo_acceso VARCHAR(20),
        ADD COLUMN IF NOT EXISTS patente VARCHAR(20),
        ADD COLUMN IF NOT EXISTS observacion TEXT;

      -- Nuevo campo: estado_pago (default 'pendiente') y constraint de valores permitidos
      ALTER TABLE ingresos_playa
        ADD COLUMN IF NOT EXISTS estado_pago VARCHAR(20) NOT NULL DEFAULT 'pendiente';

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'ingresos_playa_estado_pago_chk'
        ) THEN
          ALTER TABLE ingresos_playa
            ADD CONSTRAINT ingresos_playa_estado_pago_chk
            CHECK (estado_pago IN ('pago','pendiente','abonado_mensual','abonado_anual'));
        END IF;
      END$$;

      -- Índices útiles para historial de ingresos
      CREATE INDEX IF NOT EXISTS idx_ingresos_socio     ON ingresos_playa(socio_id);
      CREATE INDEX IF NOT EXISTS idx_ingresos_no_socio  ON ingresos_playa(no_socio_id);
      CREATE INDEX IF NOT EXISTS idx_ingresos_fecha     ON ingresos_playa(fecha_ingreso DESC);
      CREATE INDEX IF NOT EXISTS idx_ingresos_estado    ON ingresos_playa(estado_pago);

      -- =========================
      -- Vistas de presentación para la API
      -- =========================
      CREATE OR REPLACE VIEW socios_api AS
      SELECT
        id,
        nro_socio,
        apellido_nombre,
        COALESCE(TO_CHAR(fecha_nac,        'YYYY-MM-DD'), '') AS fecha_nac,
        edad,
        COALESCE(TO_CHAR(ant_fecha_alta,   'YYYY-MM-DD'), '') AS ant_fecha_alta,
        COALESCE(TO_CHAR(fecha_alta,       'YYYY-MM-DD'), '') AS fecha_alta,
        sexo,
        categoria,
        estado_general,
        COALESCE(TO_CHAR(fecha_tope,       'YYYY-MM-DD'), '') AS fecha_tope,
        COALESCE(TO_CHAR(fecha_baja,       'YYYY-MM-DD'), '') AS fecha_baja,
        tipo_socio,
        grupo_fliar,
        titular,
        tipo_doc,
        documento,
        domicilio,
        telefono,
        celular,
        email,
        ciudad,
        cp,
        provincia,
        pais,
        COALESCE(TO_CHAR(ultima_fecha_pago,'YYYY-MM-DD'), '') AS ultima_fecha_pago
      FROM socios;

      CREATE OR REPLACE VIEW ingresos_playa_api AS
      SELECT
        id,
        socio_id,
        no_socio_id,
        tipo_ingreso,
        COALESCE(TO_CHAR(fecha_ingreso, 'YYYY-MM-DD HH24:MI:SS'), '') AS fecha_ingreso,
        validado_por,
        COALESCE(tipo_acceso, '') AS tipo_acceso,
        COALESCE(patente, '')     AS patente,
        COALESCE(observacion, '') AS observacion,
        COALESCE(estado_pago, 'pendiente') AS estado_pago
      FROM ingresos_playa;
    `);

    console.log("✅ Tablas, migraciones e vistas creadas/actualizadas con éxito");
  } catch (err) {
    console.error("❌ Error creando tablas/vistas:", err);
  } finally {
    await pool.end();
  }
};

createTables();
