import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Componente para rutas públicas que redirige a home si el usuario ya está autenticado
 * 
 * Uso:
 * <Route path="/login" element={
 *   <PublicRoute>
 *     <Login />
 *   </PublicRoute>
 * } />
 * 
 * Esto evita que usuarios autenticados accedan a login/registro
 */
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Cargando...</div>
      </div>
    );
  }

  // Si ya está autenticado, redirigir al home
  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  // Si no está autenticado, mostrar el componente (login/registro)
  return children;
};

export default PublicRoute;
