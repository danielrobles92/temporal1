import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './ProtectedRoute.css';

/**
 * Componente para proteger rutas que requieren autenticación
 * 
 * Uso:
 * <Route path="/ruta-protegida" element={
 *   <ProtectedRoute>
 *     <ComponenteProtegido />
 *   </ProtectedRoute>
 * } />
 * 
 * TODO: Cuando integres con backend, puedes agregar lógica adicional aquí:
 * - Verificar permisos específicos del usuario
 * - Verificar roles (admin, usuario, etc.)
 * - Redirigir según el tipo de usuario
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Cargando...</div>
      </div>
    );
  }

  // Si no está autenticado, redirigir al login
  // TODO: Puedes guardar la ruta actual para redirigir después del login
  // Ejemplo: navigate('/login', { state: { from: location } });
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Si está autenticado, renderizar el componente hijo
  return children;
};

export default ProtectedRoute;
