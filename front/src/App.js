import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import ProtectedAdminRoute from './components/ProtectedAdminRoute/ProtectedAdminRoute';
import PublicRoute from './components/PublicRoute/PublicRoute';
import Home from './pages/Home/Home';
import Adopcion from './pages/Adopcion/Adopcion';
import MascotasPerdidas from './pages/MascotasPerdidas/MascotasPerdidas';
import PublicarMascota from './pages/PublicarMascota/PublicarMascota';
import Perfil from './pages/Perfil/Perfil';
import CrearUsuario from './pages/CrearUsuario/CrearUsuario';
import MisAnuncios from './pages/MisAnuncios/MisAnuncios';
import Solicitudes from './pages/Solicitudes/Solicitudes';
import AdminPanel from './pages/AdminPanel/AdminPanel';
import Casos from './pages/Casos/Casos';
import Login from './pages/Login/Login';
import Registro from './pages/Registro/Registro';
import './App.css';

// Componente que redirige según el estado de autenticación
const RootRedirect = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Cargando...</div>
      </div>
    );
  }

  // Si está autenticado, ir a home; si no, ir a login
  return <Navigate to={isAuthenticated ? '/home' : '/login'} replace />;
};

const MainContent = ({ children }) => {
  const { pathname } = useLocation();
  const isWidePage = pathname === '/adopcion' || pathname === '/mascotas-perdidas';

  return (
    <main className={`main-content ${isWidePage ? 'main-content-wide' : ''}`}>
      {children}
    </main>
  );
};

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="App">
          <Header />
          <MainContent>
            <Routes>
              {/* Ruta raíz: redirige según autenticación */}
              <Route path="/" element={<RootRedirect />} />
              
              {/* Rutas públicas de autenticación */}
              <Route 
                path="/login" 
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                } 
              />
              <Route 
                path="/registro" 
                element={
                  <PublicRoute>
                    <Registro />
                  </PublicRoute>
                } 
              />
              
              {/* Rutas protegidas - requieren autenticación */}
              <Route 
                path="/home" 
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/adopcion" 
                element={
                  <ProtectedRoute>
                    <Adopcion />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/mascotas-perdidas" 
                element={
                  <ProtectedRoute>
                    <MascotasPerdidas />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/mascota/:id" 
                element={
                  <ProtectedRoute>
                    <Navigate to="/adopcion" replace />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/mascota/:id/editar" 
                element={
                  <ProtectedRoute>
                    <Navigate to="/mis-anuncios" replace />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/reporte/:id" 
                element={
                  <ProtectedRoute>
                    <Navigate to="/mascotas-perdidas" replace />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/publicar" 
                element={
                  <ProtectedRoute>
                    <PublicarMascota />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/perfil" 
                element={
                  <ProtectedRoute>
                    <Perfil />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/mis-anuncios" 
                element={
                  <ProtectedRoute>
                    <MisAnuncios />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/solicitudes" 
                element={
                  <ProtectedRoute>
                    <Solicitudes />
                  </ProtectedRoute>
                } 
              />
              <Route
                path="/casos"
                element={
                  <ProtectedRoute>
                    <Casos />
                  </ProtectedRoute>
                }
              />
              <Route 
                path="/crear-usuario" 
                element={
                  <ProtectedAdminRoute>
                    <CrearUsuario />
                  </ProtectedAdminRoute>
                } 
              />
              <Route 
                path="/admin" 
                element={
                  <ProtectedAdminRoute>
                    <AdminPanel />
                  </ProtectedAdminRoute>
                } 
              />
              
              {/* TODO: Agregar más rutas protegidas según necesites */}
              {/* Ejemplo:
              <Route 
                path="/mis-anuncios" 
                element={
                  <ProtectedRoute>
                    <MisAnuncios />
                  </ProtectedRoute>
                } 
              />
              */}
            </Routes>
          </MainContent>
          <Footer />
        </div>
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;

