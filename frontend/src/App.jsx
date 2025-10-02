// import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
// import Login from "./pages/Login";
// import Socios from "./pages/Socios";
// import Ingresos from "./pages/Ingresos";
// import Dashboard from "./pages/Dashboard";
// import Navbar from "./components/Navbar";
// import Ingreso from "./pages/Ingreso";

// function App() {
//   return (
//     <Router>
//       <div className="min-h-screen bg-gray-100">
//         <Navbar />
//         <div className="p-4">
//           <Routes>
//             <Route path="/" element={<Navigate to="/dashboard" />} />
//             <Route path="/login" element={<Login />} />
//             <Route path="/dashboard" element={<Dashboard />} />
//             <Route path="/socios" element={<Socios />} />
//             <Route path="/ingresos" element={<Ingresos />} />
//             <Route path="/ingreso" element={<Ingreso />} />
//           </Routes>
//         </div>
//       </div>
//     </Router>
//   );
// }

// export default App;


import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Socios from "./pages/Socios";      // asegúrate que existe el archivo
import Ingresos from "./pages/Ingresos";  // idem
import Dashboard from "./pages/Dashboard";// opcional
import Navbar from "./components/Navbar";
import Ingreso from "./pages/Ingreso";
import SocioPerfil from "./pages/SocioPerfil";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="p-4">
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* home redirige a dashboard si está logueado, si no al login */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Navigate to="/dashboard" />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/socios"
              element={
                <ProtectedRoute>
                  <Socios />
                </ProtectedRoute>
              }
            />

            <Route
              path="/ingresos"
              element={
                <ProtectedRoute>
                  <Ingresos />
                </ProtectedRoute>
              }
            />

            <Route
              path="/ingreso"
              element={
                <ProtectedRoute>
                  <Ingreso />
                </ProtectedRoute>
              }
            />
            <Route
              path="/socios/:documento"
              element={
                <ProtectedRoute>
                  <SocioPerfil />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
