import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";

// Mapas de labels y estilos
const LABELS_ESTADO_PAGO = {
  pendiente: "Pendiente de pago",
  pago: "Pago",
  abonado_mensual: "Abonado mensual",
  abonado_anual: "Abonado anual",
};

function badgePagoClasses(value) {
  const v = (value || "pendiente").toLowerCase().replace(/\s+/g, "_");
  switch (v) {
    case "pago":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "abonado_mensual":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "abonado_anual":
      return "bg-purple-50 text-purple-700 border-purple-200";
    default:
      return "bg-amber-50 text-amber-800 border-amber-200";
  }
}

function BadgePago({ value }) {
  const v = (value || "pendiente").toLowerCase().replace(/\s+/g, "_");
  const txt = LABELS_ESTADO_PAGO[v] || "Pendiente de pago";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${badgePagoClasses(v)}`}>
      {v === "pago" && <span>✔️</span>}
      {v === "abonado_mensual" && <span>🗓️</span>}
      {v === "abonado_anual" && <span>📅</span>}
      {v === "pendiente" && <span>⏳</span>}
      {txt}
    </span>
  );
}

function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

export default function SocioPerfil() {
  const { documento } = useParams();
  const [socio, setSocio] = useState(null);
  const [ingresos, setIngresos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr("");
      try {
        const sres = await api.get(`/socios/${encodeURIComponent(documento)}`);
        const s = sres.data?.socio || null;
        setSocio(s);

        const params = new URLSearchParams({
          dni: String(documento),
          page: "1",
          limit: "200",
        });
        const ires = await api.get(`/ingresos?${params.toString()}`);
        setIngresos(ires.data?.ingresos || []);
      } catch (e) {
        setErr(e.response?.data?.error || "No se pudo cargar el perfil del socio");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [documento]);

  // Derivados visuales
  const estadoSocio = (socio?.estado_general || "").toUpperCase();
  const estadoTone =
    estadoSocio === "ACTIVO" ? "emerald" :
    estadoSocio === "SUSPENDIDO" ? "amber" :
    estadoSocio ? "red" : "slate";

  const topeVencido = useMemo(() => {
    if (!socio?.fecha_tope) return false;
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const tope = new Date(socio.fecha_tope); tope.setHours(0,0,0,0);
    return tope < hoy;
  }, [socio?.fecha_tope]);

  return (
    <div className="p-4 bg-white shadow rounded">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Perfil de Socio</h1>
          <p className="text-sm text-gray-500">DNI {documento}</p>
        </div>
        <Link
          to="/socios"
          className="text-sm px-3 py-1.5 rounded border hover:bg-gray-50"
        >
          ← Volver a Socios
        </Link>
      </div>

      {/* Banner de estado */}
      {socio && (
        <div className={`mb-4 rounded-xl border p-3 ${estadoTone === "emerald" ? "bg-emerald-50 border-emerald-200" : estadoTone === "amber" ? "bg-amber-50 border-amber-200" : estadoTone === "red" ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-200"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={estadoTone}>
              Estado: <span className="ml-1 font-semibold">{socio.estado_general || "—"}</span>
            </Pill>
            {socio.categoria && <Pill tone="blue">Categoría: <span className="ml-1 font-semibold">{socio.categoria}</span></Pill>}
            {socio.tipo_socio && <Pill tone="violet">Tipo: <span className="ml-1 font-semibold">{socio.tipo_socio}</span></Pill>}
            {socio.fecha_tope && (
              <Pill tone={topeVencido ? "red" : "slate"}>
                Fecha tope: <span className="ml-1 font-semibold">{socio.fecha_tope}</span> {topeVencido && <span className="ml-1">⚠️</span>}
              </Pill>
            )}
          </div>
        </div>
      )}

      {err && <p className="text-red-600 mb-3">{err}</p>}
      {loading ? (
        <p>Cargando…</p>
      ) : !socio ? (
        <p className="text-gray-600">Socio no encontrado.</p>
      ) : (
        <>
          {/* Datos del socio */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <div className="border rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">DNI</div>
              <div className="font-semibold text-gray-900">{socio.documento || ""}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Nro Socio</div>
              <div className="font-semibold text-gray-900">{socio.nro_socio || ""}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Nombre</div>
              <div className="font-semibold text-gray-900">{socio.apellido_nombre || ""}</div>
            </div>

            <div className="border rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Fecha Nac.</div>
              <div className="font-medium">{socio.fecha_nac || ""}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Edad</div>
              <div className="font-medium">{socio.edad ?? ""}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Ant. Fecha Alta</div>
              <div className="font-medium">{socio.ant_fecha_alta || ""}</div>
            </div>

            <div className="border rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Fecha Alta</div>
              <div className="font-medium">{socio.fecha_alta || ""}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Fecha Baja</div>
              <div className="font-medium">{socio.fecha_baja || ""}</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Última Fecha Pago</div>
              <div className="font-medium">{socio.ultima_fecha_pago || ""}</div>
            </div>

            <div className="border rounded-lg p-3 md:col-span-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Titular / Grupo Fliar</div>
              <div className="font-medium">
                {socio.titular || ""} {socio.grupo_fliar ? ` / ${socio.grupo_fliar}` : ""}
              </div>
            </div>

            <div className="border rounded-lg p-3 md:col-span-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Contacto</div>
              <div className="font-medium">
                {socio.telefono || ""} {socio.celular ? ` / ${socio.celular}` : ""} {socio.email ? ` / ${socio.email}` : ""}
              </div>
            </div>

            <div className="border rounded-lg p-3 md:col-span-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Dirección</div>
              <div className="font-medium">
                {socio.domicilio || ""}
                {socio.ciudad ? `, ${socio.ciudad}` : ""}
                {socio.provincia ? `, ${socio.provincia}` : ""}
                {socio.pais ? `, ${socio.pais}` : ""}
                {socio.cp ? ` (CP ${socio.cp})` : ""}
              </div>
            </div>
          </div>

          {/* Historial de ingresos */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Ingresos de este socio</h2>
            <div className="text-xs text-gray-500">
              Total: <span className="font-semibold">{ingresos.length}</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr className="text-left">
                  <th className="p-2 border-r">Fecha</th>
                  <th className="p-2 border-r">Tipo</th>
                  <th className="p-2 border-r">Validado por</th>
                  <th className="p-2 border-r">Acceso</th>
                  <th className="p-2 border-r">Patente</th>
                  <th className="p-2 border-r">Observación</th>
                  <th className="p-2">Estado de pago</th>
                </tr>
              </thead>
              <tbody>
                {ingresos.map((i, idx) => (
                  <tr
                    key={i.id}
                    className={`hover:bg-gray-50 ${idx % 2 === 1 ? "bg-gray-50/40" : ""}`}
                  >
                    <td className="p-2 border-t border-r">{i.fecha_ingreso}</td>
                    <td className="p-2 border-t border-r">
                      <Pill tone={i.tipo_ingreso === "socio" ? "emerald" : "blue"}>
                        {i.tipo_ingreso === "socio" ? "Socio" : "Visitante"}
                      </Pill>
                    </td>
                    <td className="p-2 border-t border-r">{i.validado_por}</td>
                    <td className="p-2 border-t border-r">
                      {i.tipo_acceso ? <Pill tone="slate">{i.tipo_acceso}</Pill> : "—"}
                    </td>
                    <td className="p-2 border-t border-r">
                      {i.patente ? <Pill tone="slate">{i.patente}</Pill> : "—"}
                    </td>
                    <td className="p-2 border-t border-r">{i.observacion || "—"}</td>
                    <td className="p-2 border-t">
                      <BadgePago value={i.estado_pago} />
                    </td>
                  </tr>
                ))}
                {ingresos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center p-4 text-gray-500">
                      Sin ingresos registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
