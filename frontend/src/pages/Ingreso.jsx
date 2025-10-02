import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { getCurrentUser } from "../lib/auth";
import QRScanner from "../components/QRScanner";

function Resultado({ data }) {
  if (!data) return null;
  const socio = data.socio;
  const visitante = data.visitante;
  return (
    <div className="mt-4 border rounded-lg p-4 bg-gray-50">
      <h3 className="font-bold mb-2">Último registro</h3>
      {data.tipo === "socio" ? (
        <ul className="text-sm space-y-1">
          <li><strong>Tipo:</strong> Socio</li>
          <li><strong>DNI:</strong> {socio?.documento}</li>
          <li><strong>Nro Socio:</strong> {socio?.nro_socio || ""}</li>
          <li><strong>Nombre:</strong> {socio?.nombre_completo}</li>
          <li><strong>Estado:</strong> {socio?.estado_general || ""}</li>
          {data.tipo_acceso && <li><strong>Acceso:</strong> {data.tipo_acceso}</li>}
          {data.patente && <li><strong>Patente:</strong> {data.patente}</li>}
          {data.observacion && <li><strong>Obs.:</strong> {data.observacion}</li>}
          <li><strong>Validado por:</strong> {data.validado_por}</li>
          {data.fecha && <li><strong>Fecha:</strong> {data.fecha}</li>}
        </ul>
      ) : (
        <ul className="text-sm space-y-1">
          <li><strong>Tipo:</strong> Visitante</li>
          <li><strong>DNI:</strong> {visitante?.dni || ""}</li>
          <li><strong>Nombre:</strong> {visitante?.nombre_completo || ""}</li>
          {data.tipo_acceso && <li><strong>Acceso:</strong> {data.tipo_acceso}</li>}
          {data.patente && <li><strong>Patente:</strong> {data.patente}</li>}
          {data.observacion && <li><strong>Obs.:</strong> {data.observacion}</li>}
          <li><strong>Validado por:</strong> {data.validado_por}</li>
          {data.fecha && <li><strong>Fecha:</strong> {data.fecha}</li>}
        </ul>
      )}
    </div>
  );
}

export default function Ingreso() {
  const user = useMemo(() => getCurrentUser(), []);
  const [tab, setTab] = useState("socio"); // 'socio' | 'visitante'
  const [modoSocio, setModoSocio] = useState("qr"); // 'qr' | 'manual'
  const [validadoPor, setValidadoPor] = useState(user?.username || "empleado");

  // Campos comunes
  const [tipoAcceso, setTipoAcceso] = useState("auto"); // auto | moto | bici | peaton
  const [patente, setPatente] = useState("");
  const [observacion, setObservacion] = useState("");

  // SOCIO (manual)
  const [dniSocio, setDniSocio] = useState("");
  const [nroSocio, setNroSocio] = useState("");
  const [loadingSocio, setLoadingSocio] = useState(false);
  const [errorSocio, setErrorSocio] = useState("");

  // Sugerencias por DNI (para socio manual)
  const [sugOpen, setSugOpen] = useState(false);
  const [sugLoading, setSugLoading] = useState(false);
  const [sugItems, setSugItems] = useState([]); // [{id, documento, apellido_nombre, nro_socio}]

  // VISITANTE
  const [dniVis, setDniVis] = useState("");
  const [nombreVis, setNombreVis] = useState("");
  const [loadingVis, setLoadingVis] = useState(false);
  const [errorVis, setErrorVis] = useState("");

  const [ultimo, setUltimo] = useState(null); // {tipo, socio|visitante, validado_por, fecha, tipo_acceso, patente, observacion}

  // Debounce & fetch de sugerencias por DNI (3+ dígitos) — usa ?search
  useEffect(() => {
    const q = dniSocio.trim();
    if (!/^\d{3,}$/.test(q)) {
      setSugItems([]);
      setSugOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setSugLoading(true);
        const params = new URLSearchParams({ search: q, page: "1", limit: "5" });
        const { data } = await api.get(`/socios?${params.toString()}`);
        setSugItems((data.socios || []).map(s => ({
          id: s.id,
          documento: s.documento,
          apellido_nombre: s.apellido_nombre,
          nro_socio: s.nro_socio || "",
        })));
        setSugOpen(true);
      } catch {
        setSugItems([]);
        setSugOpen(false);
      } finally {
        setSugLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [dniSocio]);

  const pickSugerencia = (item) => {
    setDniSocio(item.documento || "");
    setNroSocio(item.nro_socio || "");
    setSugOpen(false);
  };

  const registrarSocioPorUUID = async (uuid) => {
    if (!uuid) return;
    setErrorSocio("");
    if (!validadoPor.trim()) {
      setErrorSocio("Completá 'Validado por'.");
      return;
    }
    try {
      setLoadingSocio(true);
      const resp = await api.post("/ingresos/qr-uuid", {
        uuid,
        validado_por: validadoPor.trim(),
        tipo_acceso: tipoAcceso,
        patente: patente.trim().toUpperCase(),
        observacion: observacion.trim(),
      });
      const socio = resp.data?.socio || null;
      setUltimo({
        tipo: "socio",
        socio,
        validado_por: validadoPor.trim(),
        tipo_acceso: tipoAcceso,
        patente: patente.trim().toUpperCase(),
        observacion: observacion.trim(),
        fecha: new Date().toLocaleString("es-AR", {
          timeZone: "America/Argentina/Buenos_Aires",
          hour12: false,
        }),
      });
    } catch (e) {
      setErrorSocio(e.response?.data?.error || "No se pudo registrar el ingreso del socio (QR).");
    } finally {
      setLoadingSocio(false);
    }
  };

  const onRegistrarSocioManual = async () => {
    setErrorSocio("");
    if (!validadoPor.trim()) return setErrorSocio("Completá 'Validado por'.");
    if (!dniSocio.trim() && !nroSocio.trim()) {
      setErrorSocio("Ingresá DNI o Nro. de socio.");
      return;
    }
    try {
      setLoadingSocio(true);

      // 🔑 Enviar qrData como JSON para que el backend lo parsee seguro
      const qrData = dniSocio.trim()
        ? JSON.stringify({ documento: dniSocio.trim().replace(/\D/g, "") })
        : JSON.stringify({ nro_socio: nroSocio.trim() });

      const resp = await api.post("/ingresos/qr", {
        qrData,
        validado_por: validadoPor.trim(),
        tipo_acceso: tipoAcceso,
        patente: patente.trim().toUpperCase(),
        observacion: observacion.trim(),
      });
      const socio = resp.data?.socio || null;
      setUltimo({
        tipo: "socio",
        socio,
        validado_por: validadoPor.trim(),
        tipo_acceso: tipoAcceso,
        patente: patente.trim().toUpperCase(),
        observacion: observacion.trim(),
        fecha: new Date().toLocaleString("es-AR", {
          timeZone: "America/Argentina/Buenos_Aires",
          hour12: false,
        }),
      });
      setDniSocio("");
      setNroSocio("");
      setSugItems([]);
      setSugOpen(false);
    } catch (e) {
      setErrorSocio(e.response?.data?.error || "No se pudo registrar el ingreso del socio.");
    } finally {
      setLoadingSocio(false);
    }
  };

  const onRegistrarVisitante = async () => {
    setErrorVis("");
    if (!validadoPor.trim()) return setErrorVis("Completá 'Validado por'.");
    try {
      setLoadingVis(true);
      const resp = await api.post("/ingresos/visitante", {
        dni: dniVis.trim(),
        nombre_completo: nombreVis.trim(),
        validado_por: validadoPor.trim(),
        tipo_acceso: tipoAcceso,
        patente: patente.trim().toUpperCase(),
        observacion: observacion.trim(),
      });
      const visitante = resp.data?.visitante || null;
      setUltimo({
        tipo: "visitante",
        visitante,
        validado_por: validadoPor.trim(),
        tipo_acceso: tipoAcceso,
        patente: patente.trim().toUpperCase(),
        observacion: observacion.trim(),
        fecha: new Date().toLocaleString("es-AR", {
          timeZone: "America/Argentina/Buenos_Aires",
          hour12: false,
        }),
      });
      setDniVis("");
      setNombreVis("");
    } catch (e) {
      setErrorVis(e.response?.data?.error || "No se pudo registrar el ingreso del visitante.");
    } finally {
      setLoadingVis(false);
    }
  };

  return (
    <div className="p-4 bg-white shadow rounded max-w-3xl">
      <h1 className="text-xl font-bold mb-4">Registrar Ingreso</h1>

      <div className="flex gap-2 mb-4">
        <button
          className={`px-4 py-2 rounded border ${tab === "socio" ? "bg-blue-600 text-white" : "bg-white"}`}
          onClick={() => setTab("socio")}
        >
          Socio
        </button>
        <button
          className={`px-4 py-2 rounded border ${tab === "visitante" ? "bg-blue-600 text-white" : "bg-white"}`}
          onClick={() => setTab("visitante")}
        >
          Visitante (No socio)
        </button>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-gray-600">Validado por</label>
          <input
            value={validadoPor}
            onChange={(e) => setValidadoPor(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Campos comunes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Tipo de acceso</label>
          <select
            value={tipoAcceso}
            onChange={(e) => setTipoAcceso(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          >
            <option value="auto">Auto</option>
            <option value="moto">Moto</option>
            <option value="bici">Bici</option>
            <option value="peaton">Peatón</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Patente</label>
          <input
            value={patente}
            onChange={(e) => setPatente(e.target.value.toUpperCase())}
            placeholder="AAA123 / AB123CD"
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        <div className="md:col-span-1">
          <label className="block text-sm text-gray-600 mb-1">Observación</label>
          <input
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
      </div>

      {tab === "socio" ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              className={`px-3 py-2 rounded border ${modoSocio === "qr" ? "bg-blue-600 text-white" : "bg-white"}`}
              onClick={() => setModoSocio("qr")}
            >
              QR (cámara)
            </button>
            <button
              className={`px-3 py-2 rounded border ${modoSocio === "manual" ? "bg-blue-600 text-white" : "bg-white"}`}
              onClick={() => setModoSocio("manual")}
            >
              Manual (DNI o Nro. Socio)
            </button>
          </div>

          {modoSocio === "qr" ? (
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Apuntá la cámara al QR del carnet. Se registrará automáticamente al detectar la UUID.
              </p>
              <div className="rounded-xl overflow-hidden border">
                <QRScanner
                  onScan={(text) => {
                    const uuidRegex =
                      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                    if (uuidRegex.test(text)) {
                      registrarSocioPorUUID(text);
                    }
                  }}
                  onError={() => {}}
                />
              </div>
              {errorSocio && <p className="text-red-600 text-sm mt-2">{errorSocio}</p>}
              {loadingSocio && <p className="text-sm text-gray-600 mt-2">Registrando...</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* DNI con sugerencias */}
                <div className="relative">
                  <label className="block text-sm text-gray-600 mb-1">DNI</label>
                  <input
                    value={dniSocio}
                    onChange={(e) => setDniSocio(e.target.value.replace(/\D/g, ""))}
                    className="border rounded px-3 py-2 w-full"
                    inputMode="numeric"
                    onFocus={() => { if (sugItems.length) setSugOpen(true); }}
                    onBlur={() => setTimeout(() => setSugOpen(false), 150)}
                    aria-autocomplete="list"
                    aria-expanded={sugOpen}
                  />
                  {sugOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow">
                      {sugLoading && (
                        <div className="px-3 py-2 text-sm text-gray-500">Buscando…</div>
                      )}
                      {!sugLoading && sugItems.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">Sin coincidencias</div>
                      )}
                      {!sugLoading && sugItems.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickSugerencia(item)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                        >
                          <div className="font-medium">{item.documento}</div>
                          <div className="text-gray-600">{item.apellido_nombre}</div>
                          {item.nro_socio ? (
                            <div className="text-gray-500 text-xs">Nro socio: {item.nro_socio}</div>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Nro. Socio</label>
                  <input
                    value={nroSocio}
                    onChange={(e) => setNroSocio(e.target.value)}
                    className="border rounded px-3 py-2 w-full"
                  />
                </div>
              </div>

              {errorSocio && <p className="text-red-600 text-sm">{errorSocio}</p>}

              <div className="flex gap-2">
                <button
                  onClick={onRegistrarSocioManual}
                  disabled={loadingSocio}
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:opacity-90 disabled:opacity-50"
                >
                  {loadingSocio ? "Registrando..." : "Registrar ingreso de socio"}
                </button>
                <button
                  onClick={() => {
                    setDniSocio("");
                    setNroSocio("");
                    setSugItems([]);
                    setSugOpen(false);
                  }}
                  className="px-4 py-2 rounded border"
                  type="button"
                >
                  Limpiar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">DNI (opcional)</label>
              <input
                value={dniVis}
                onChange={(e) => setDniVis(e.target.value.replace(/\D/g, ""))}
                className="border rounded px-3 py-2 w-full"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Nombre (opcional)</label>
              <input
                value={nombreVis}
                onChange={(e) => setNombreVis(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              />
            </div>
          </div>

          {errorVis && <p className="text-red-600 text-sm">{errorVis}</p>}

          <button
            onClick={onRegistrarVisitante}
            disabled={loadingVis}
            className="px-4 py-2 rounded bg-emerald-600 text-white hover:opacity-90 disabled:opacity-50"
          >
            {loadingVis ? "Registrando..." : "Registrar ingreso de visitante"}
          </button>
        </div>
      )}

      <Resultado data={ultimo} />
    </div>
  );
}
