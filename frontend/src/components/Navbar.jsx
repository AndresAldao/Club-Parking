import { Link, useNavigate } from "react-router-dom";
import { isAuthenticated, clearToken, getCurrentUser } from "../lib/auth";

export default function Navbar() {
  const authed = isAuthenticated();
  const user = getCurrentUser();
  const navigate = useNavigate();

  return (
    <nav className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link to="/" className="font-bold">Club Parking</Link>

        {authed && (
          <>
            <Link to="/dashboard" className="text-sm">Dashboard</Link>
            <Link to="/socios" className="text-sm">Socios</Link>
            <Link to="/ingreso" className="text-sm">Registrar Ingreso</Link>
            <Link to="/ingresos" className="text-sm">Historial de Ingresos</Link>
          </>
        )}

        <div className="ml-auto flex items-center gap-3">
          {authed ? (
            <>
              <span className="text-sm text-gray-600">{user?.username}</span>
              <button
                onClick={() => { clearToken(); localStorage.removeItem("user"); navigate("/login"); }}
                className="px-3 py-1 border rounded text-sm"
              >
                Salir
              </button>
            </>
          ) : (
            <Link to="/login" className="px-3 py-1 border rounded text-sm">Ingresar</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
