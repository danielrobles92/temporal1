import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './ProtectedAdminRoute.css';

/**
 * Componente para proteger rutas que requieren permisos de administrador
 * 
 * Uso:
 * <Route path="/ruta-admin" element={
 *   <ProtectedAdminRoute>
 *     <ComponenteAdmin />
 *   </ProtectedAdminRoute>
 * } />
 */
const ProtectedAdminRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Cargando...</div>
      </div>
    );
  }

  // Si no está autenticado, redirigir al login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Si no es administrador, redirigir al home
  if (!user || !user.isAdmin) {
    return <Navigate to="/home" replace />;
  }

  // Si es administrador, renderizar el componente hijo
  return children;
};

export default ProtectedAdminRoute;
