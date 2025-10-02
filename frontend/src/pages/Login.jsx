import { useState } from "react";
import api from "../lib/api";




function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // limpio error previo
    try {
      const res = await api.post("/auth/login", { username, password });
      localStorage.setItem("token", res.data.token);
      alert("Login exitoso 🚀");
      // acá podés redirigir con react-router
    } catch (err) {
      console.error("Error en login:", err);
      setError(
        err.response?.data?.error || "No se pudo iniciar sesión. Verifica credenciales."
      );
    }
  };

  return (
    <div className="p-4 max-w-sm mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border p-2"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2"
        />
        <button type="submit" className="bg-blue-500 text-white p-2">
          Ingresar
        </button>
      </form>
      {error && <p className="text-red-600 mt-2">{error}</p>}
    </div>
  );
}

export default Login;
