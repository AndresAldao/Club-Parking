import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";

// Helpers UI
function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}
function StatusBadge({ estado }) {
  const e = String(estado || "").trim().toUpperCase();
  let color =
    e === "ACTIVO"
      ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
      : e === "INACTIVO" || e === "BAJA"
      ? "bg-rose-100 text-rose-800 ring-rose-200"
      : "bg-gray-100 text-gray-700 ring-gray-200";
  return (
    <span className={classNames(
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1",
      color
    )}>
      {estado || "—"}
    </span>
  );
}
function DateCell({ value }) {
  return (
    <span className={classNames(
      "inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1",
      value ? "bg-slate-100 text-slate-700 ring-slate-200" : "text-slate-400 ring-slate-100"
    )}>
      {value || "—"}
    </span>
  );
}
function SkeletonRow() {
  return (
    <tr>
      {[...Array(8)].map((_, i) => (
        <td key={i} className="p-2 border">
          <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
        </td>
      ))}
    </tr>
  );
}

export default function Socios() {
  const [socios, setSocios] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Buscador
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  async function fetchSocios(p = page, l = limit, query = qDebounced) {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(l) });
      if (query) params.set("search", query); // el backend espera `search`
      const { data } = await api.get(`/socios?${params.toString()}`);
      setSocios(data.socios || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      setErr(e.response?.data?.error || "Error cargando socios");
    } finally {
      setLoading(false);
    }
  }

  // recargar cuando cambien page/limit o el término debounced
  useEffect(() => {
    fetchSocios(1, limit, qDebounced);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced, limit]);

  useEffect(() => {
    fetchSocios(page, limit, qDebounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const onChangeLimit = (e) => setLimit(parseInt(e.target.value, 10));

  const onJump = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const val = Math.max(1, Math.min(totalPages, parseInt(form.get("p") || "1", 10)));
    setPage(val);
  };

  const placeholder = useMemo(
    () => "Buscar por DNI, Nro Socio o Nombre…",
    []
  );

  return (
    <div className="p-4 bg-white shadow-sm ring-1 ring-gray-200 rounded-xl">
      {/* Header + search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold">Gestión de Socios</h1>
          <p className="text-sm text-gray-500">Listados, búsqueda y acceso rápido al perfil.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">
              🔎
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              className="border rounded-lg pl-8 pr-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <label className="text-sm text-gray-600">Filas:</label>
          <select
            value={limit}
            onChange={onChangeLimit}
            className="border rounded-lg px-2 py-2 text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {err && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700">
          {err}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg ring-1 ring-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr className="text-left text-gray-600">
              <th className="p-2 border-b">#</th>
              <th className="p-2 border-b">Nro Socio</th>
              <th className="p-2 border-b">DNI</th>
              <th className="p-2 border-b">Apellido y Nombre</th>
              <th className="p-2 border-b">Estado</th>
              <th className="p-2 border-b">Fecha Tope</th>
              <th className="p-2 border-b">Última Fecha Pago</th>
              <th className="p-2 border-b text-center">Perfil</th>
            </tr>
          </thead>

          <tbody>
            {loading
              ? [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
              : socios.map((s, idx) => (
                  <tr
                    key={s.id}
                    className="odd:bg-white even:bg-slate-50 hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="p-2 border-b text-slate-500">
                      {(page - 1) * limit + idx + 1}
                    </td>
                    <td className="p-2 border-b font-medium">{s.nro_socio || ""}</td>
                    <td className="p-2 border-b">{s.documento}</td>
                    <td className="p-2 border-b">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{s.apellido_nombre}</div>
                        {/* chip por categoría si querés: */}
                        {s.categoria ? (
                          <span className="text-[10px] rounded-full bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200 px-2 py-0.5">
                            {s.categoria}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-2 border-b">
                      <StatusBadge estado={s.estado_general} />
                    </td>
                    <td className="p-2 border-b">
                      <DateCell value={s.fecha_tope} />
                    </td>
                    <td className="p-2 border-b">
                      <DateCell value={s.ultima_fecha_pago} />
                    </td>
                    <td className="p-2 border-b text-center">
                      <Link
                        to={`/socios/${encodeURIComponent(s.documento)}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-300"
                        title="Ver perfil del socio"
                      >
                        Ver perfil →
                      </Link>
                    </td>
                  </tr>
                ))}

            {!loading && socios.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">
                  <div className="mx-auto mb-2 text-2xl">😕</div>
                  <div className="font-medium">Sin resultados</div>
                  <div className="text-sm">Probá ajustar la búsqueda o los filtros.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <div className="text-sm text-gray-600">
          Mostrando{" "}
          <strong>
            {socios.length ? (page - 1) * limit + 1 : 0}–{(page - 1) * limit + socios.length}
          </strong>{" "}
          de <strong>{total}</strong>
          {qDebounced ? <> (filtrado por “{qDebounced}”)</> : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
            onClick={() => setPage(1)}
            disabled={!canPrev}
            title="Primera"
          >
            «
          </button>
          <button
            className="px-3 py-1 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
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
              className="w-16 border rounded-lg px-2 py-1 text-sm"
            />
            <span className="text-sm text-gray-600">/ {totalPages}</span>
            <button className="ml-1 px-3 py-1 rounded-lg border bg-white text-sm hover:bg-gray-50" type="submit">
              Ir
            </button>
          </form>

          <button
            className="px-3 py-1 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={!canNext}
            title="Siguiente"
          >
            ›
          </button>
          <button
            className="px-3 py-1 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"
            onClick={() => setPage(totalPages)}
            disabled={!canNext}
            title="Última"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}
