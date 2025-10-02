import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";

function hoyISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Valores usados en UI <-> Backend
const ESTADOS_UI = [
  { value: "pendiente", label: "Pendiente de pago" },
  { value: "pago", label: "Pago" },
  { value: "abonado_mensual", label: "Abonado mensual" },
  { value: "abonado_anual", label: "Abonado anual" },
];

export default function Ingresos() {
  // filtros
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [dni, setDni] = useState("");
  const [dniDebounced, setDniDebounced] = useState("");
  const [tipo, setTipo] = useState(""); // '', 'socio', 'no_socio'
  const [estadoFiltro, setEstadoFiltro] = useState(""); // '', 'pendiente', 'pago', ...

  // paginación
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // data
  const [ingresos, setIngresos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // fila que está guardando (por id)
  const [savingId, setSavingId] = useState(null);

  // debounce DNI (400ms)
  useEffect(() => {
    const t = setTimeout(() => setDniDebounced(dni.trim()), 400);
    return () => clearTimeout(t);
  }, [dni]);

  async function fetchIngresos(p = page, l = limit) {
    setLoading(true);
    setErr("");

    try {
      const qs = new URLSearchParams({
        page: String(p),
        limit: String(l),
      });

      if (desde) qs.set("desde", desde);
      if (hasta) qs.set("hasta", hasta);
      if (dniDebounced) qs.set("dni", dniDebounced);
      if (tipo) qs.set("tipo", tipo);
      if (estadoFiltro) qs.set("estado_pago", estadoFiltro);

      const { data } = await api.get(`/ingresos?${qs.toString()}`);
      setIngresos(data.ingresos || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      setErr(e.response?.data?.error || "Error cargando ingresos");
    } finally {
      setLoading(false);
    }
  }

  // cuando cambian filtros "fuertes", volvemos a página 1
  useEffect(() => {
    setPage(1);
    fetchIngresos(1, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, dniDebounced, tipo, estadoFiltro, limit]);

  // cambio de página
  useEffect(() => {
    fetchIngresos(page, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const onJump = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const val = Math.max(1, Math.min(totalPages, parseInt(form.get("p") || "1", 10)));
    setPage(val);
  };

  const rangoTexto = useMemo(() => {
    if (!ingresos.length) return "Sin resultados";
    const ini = (page - 1) * limit + 1;
    const fin = (page - 1) * limit + ingresos.length;
    return `Mostrando ${ini}–${fin} de ${total}`;
  }, [ingresos.length, page, limit, total]);

  // Guardar estado pago (optimista)
  const updateEstadoPago = async (id, nuevoValor) => {
    const prev = ingresos;
    const next = ingresos.map(r => r.id === id ? { ...r, estado_pago: nuevoValor } : r);
    setIngresos(next);
    setSavingId(id);
    try {
      // El backend acepta variantes y normaliza; enviamos label “humana”
      const labelBackend =
        nuevoValor === "pendiente" ? "pendiente" :
        nuevoValor === "pago" ? "pago" :
        nuevoValor === "abonado_mensual" ? "abonado mensual" :
        "abonado anual";

      await api.patch(`/ingresos/${id}/estado-pago`, { estado_pago: labelBackend });
    } catch (e) {
      setIngresos(prev);
      alert(e.response?.data?.error || "No se pudo actualizar el estado de pago");
    } finally {
      setSavingId(null);
    }
  };

  // Badge para estado (solo visual)
  const EstadoBadge = ({ value }) => {
    const v = value || "pendiente";
    const map = {
      pendiente: "bg-yellow-100 text-yellow-800 border-yellow-200",
      pago: "bg-emerald-100 text-emerald-800 border-emerald-200",
      abonado_mensual: "bg-blue-100 text-blue-800 border-blue-200",
      abonado_anual: "bg-purple-100 text-purple-800 border-purple-200",
    };
    const label = ESTADOS_UI.find(e => e.value === v)?.label || v;
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full border ${map[v] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="p-4 bg-white shadow rounded">
      <h1 className="text-xl font-bold mb-4">Registro de Ingresos</h1>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">DNI</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="\\d*"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
            placeholder="Ej: 40101601"
            className="border rounded px-3 py-2 text-sm w-44"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="socio">Socio</option>
            <option value="no_socio">No socio</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Estado</label>
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {ESTADOS_UI.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-gray-600">Filas:</label>
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10))}
            className="border rounded px-2 py-2 text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {err && <p className="text-red-600 mb-3">{err}</p>}
      {loading ? (
        <p>Cargando ingresos...</p>
      ) : (
        <>
          <table className="w-full border border-gray-300 text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-2 border">#</th>
                <th className="p-2 border">Tipo</th>
                <th className="p-2 border">DNI</th>
                <th className="p-2 border">Nombre</th>
                <th className="p-2 border">Fecha</th>
                <th className="p-2 border">Validado por</th>
                <th className="p-2 border">Estado</th>
                <th className="p-2 border">Perfil</th>
              </tr>
            </thead>
            <tbody>
              {ingresos.map((i, idx) => {
                const esSocio = Boolean(i.socio?.dni);
                const doc = i.socio?.dni;
                const nombre = i.socio?.nombre_completo || i.no_socio?.nombre_completo || "-";
                const dniMostrar = i.socio?.dni || i.no_socio?.dni || "-";
                return (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="p-2 border">{(page - 1) * limit + idx + 1}</td>
                    <td className="p-2 border">{i.tipo_ingreso}</td>
                    <td className="p-2 border">{dniMostrar}</td>
                    <td className="p-2 border">{nombre}</td>
                    <td className="p-2 border">
                      {typeof i.fecha_ingreso === "string"
                        ? i.fecha_ingreso
                        : new Date(i.fecha_ingreso).toLocaleString("es-AR", {
                            timeZone: "America/Argentina/Buenos_Aires",
                            hour12: false,
                          })}
                    </td>
                    <td className="p-2 border">{i.validado_por}</td>
                    <td className="p-2 border">
                      <div className="flex items-center gap-2">
                        <select
                          value={i.estado_pago || "pendiente"}
                          onChange={(e) => updateEstadoPago(i.id, e.target.value)}
                          className="border rounded px-2 py-1"
                          disabled={savingId === i.id}
                          title="Editar estado de pago"
                        >
                          {ESTADOS_UI.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <EstadoBadge value={i.estado_pago} />
                        {savingId === i.id && (
                          <span className="text-xs text-gray-500">Guardando…</span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 border text-center">
                      {esSocio ? (
                        <Link
                          to={`/socios/${encodeURIComponent(doc)}`}
                          className="text-blue-600 hover:underline"
                          title="Ver perfil del socio"
                        >
                          Ver perfil
                        </Link>
                      ) : (
                        <button
                          className="text-gray-400 cursor-not-allowed"
                          title="Sin perfil (no socio)"
                          disabled
                        >
                          Ver perfil
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {ingresos.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center p-4 text-gray-500">
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <div className="text-sm text-gray-600">{rangoTexto}</div>

            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1 border rounded disabled:opacity-50"
                onClick={() => setPage(1)}
                disabled={!canPrev}
                title="Primera"
              >
                «
              </button>
              <button
                className="px-3 py-1 border rounded disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!canPrev}
                title="Anterior"
              >
                ‹
              </button>

              <form onSubmit={onJump} className="flex items-center gap-1">
                <input
                  name="p"
                  type="number"
                  min={1}
                  max={totalPages}
                  defaultValue={page}
                  className="w-16 border rounded px-2 py-1 text-sm"
                />
                <span className="text-sm text-gray-600">/ {totalPages}</span>
                <button className="ml-1 px-3 py-1 border rounded text-sm" type="submit">
                  Ir
                </button>
              </form>

              <button
                className="px-3 py-1 border rounded disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={!canNext}
                title="Siguiente"
              >
                ›
              </button>
              <button
                className="px-3 py-1 border rounded disabled:opacity-50"
                onClick={() => setPage(totalPages)}
                disabled={!canNext}
                title="Última"
              >
                »
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
