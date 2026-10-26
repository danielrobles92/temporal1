import React, { createContext, useState, useContext, useEffect } from 'react';

// Contexto de autenticación
// Este contexto maneja el estado de autenticación de la aplicación
const AuthContext = createContext(null);

/** Decodifica el JWT y verifica que no haya expirado (sin validar la firma; eso lo hace el backend). */
const isTokenValid = (token) => {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return !!payload.exp && payload.exp * 1000 > Date.now();
  } catch (e) {
    return false;
  }
};

/**
 * Provider de autenticación
 * 
 * NOTA PARA INTEGRACIÓN FUTURA CON BACKEND:
 * 
 * 1. ALMACENAMIENTO DE TOKEN:
 *    - Actualmente se usa localStorage para simular persistencia
 *    - Cuando integres con el backend, guarda el token JWT recibido:
 *      localStorage.setItem('token', response.data.token);
 *      localStorage.setItem('user', JSON.stringify(response.data.user));
 * 
 * 2. ENDPOINTS A CONSUMIR:
 *    - LOGIN: POST /api/auth/login
 *      Body: { email: string, password: string }
 *      Response: { token: string, user: { id, name, email, ... } }
 * 
 *    - REGISTRO: POST /api/auth/register
 *      Body: { name: string, email: string, password: string, confirmPassword: string }
 *      Response: { token: string, user: { id, name, email, ... } }
 * 
 *    - LOGOUT: POST /api/auth/logout (opcional, si el backend requiere invalidar token)
 *      Headers: { Authorization: `Bearer ${token}` }
 * 
 *    - VERIFICAR TOKEN: GET /api/auth/verify
 *      Headers: { Authorization: `Bearer ${token}` }
 *      Response: { valid: boolean, user: {...} }
 * 
 * 3. MANEJO DE ERRORES:
 *    - Captura errores de red (axios/fetch)
 *    - Maneja códigos de estado HTTP (401, 403, 500, etc.)
 *    - Muestra mensajes de error apropiados al usuario
 * 
 * 4. REFRESH TOKEN (si aplica):
 *    - Si tu backend usa refresh tokens, implementa lógica para renovar automáticamente
 *    - Intercepta requests 401 y renueva el token antes de reintentar
 * 
 * 5. EJEMPLO DE IMPLEMENTACIÓN:
 * 
 *    const login = async (email, password) => {
 *      try {
 *        const response = await fetch('/api/auth/login', {
 *          method: 'POST',
 *          headers: { 'Content-Type': 'application/json' },
 *          body: JSON.stringify({ email, password })
 *        });
 *        
 *        if (!response.ok) {
 *          const error = await response.json();
 *          throw new Error(error.message || 'Error al iniciar sesión');
 *        }
 *        
 *        const data = await response.json();
 *        setUser(data.user);
 *        setToken(data.token);
 *        localStorage.setItem('token', data.token);
 *        localStorage.setItem('user', JSON.stringify(data.user));
 *        return { success: true };
 *      } catch (error) {
 *        return { success: false, error: error.message };
 *      }
 *    };
 */
export const AuthProvider = ({ children }) => {
  // Estado del usuario autenticado
  // En producción, esto vendrá del token decodificado o del backend
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restaurar sesión SOLO si el token sigue siendo válido (no expirado).
  // Esto evita que el usuario quede "conectado" indefinidamente tras caducar.
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedUser && isTokenValid(token)) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error al cargar usuario:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    } else {
      // Token ausente o expirado: limpiar para forzar nuevo login.
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    }
    setLoading(false);
  }, []);

  /**
   * Función de login
   * 
   * TODO: Reemplazar con llamada real al backend
   * 
   * @param {string} username - Username del usuario
   * @param {string} password - Contraseña del usuario
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const login = async (email, password) => {
    // Login REAL contra tu servicio:
    // POST http://localhost:8080/auth/login
    // Body: { email, password }
    // Response esperado:
    // {
    //   "success": boolean,
    //   "message": string,
    //   "username": string,
    //   "isAdmin": boolean,
    //   "id": number|string,
    //   "token": string
    // }
    //
    // TODO (recomendado): mover la base URL a una variable de entorno:
    // - Crear `.env` con: REACT_APP_API_URL=http://localhost:8080
    // - Y usar: `${process.env.REACT_APP_API_URL}/auth/login`
    //
    // TODO (CORS): si te falla por CORS, habilítalo en el backend para http://localhost:3000
    // y permite headers: Content-Type, Authorization.

    try {
      const response = await fetch('http://localhost:8080/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      // Algunos backends devuelven 200 incluso cuando success=false.
      // Por eso parseamos JSON siempre que sea posible y validamos `data.success`.
      let data = null;
      try {
        data = await response.json();
      } catch (e) {
        // Si no hay JSON, seguimos con un mensaje genérico.
      }

      if (!response.ok) {
        const msg =
          (data && (data.message || data.error)) ||
          `Error HTTP ${response.status} al iniciar sesión`;
        return { success: false, error: msg };
      }

      if (!data || data.success !== true) {
        return {
          success: false,
          error: (data && data.message) || 'Credenciales inválidas',
        };
      }

      // Normalizamos el usuario para el frontend
      const normalizedUser = {
        id: data.id,
        name: data.username, // el frontend usa `name` para mostrar en el Header/Perfil
        username: data.username,
        email: email, // Use the email provided in the form
        isAdmin: data.isAdmin,
        role: data.role || (data.isAdmin ? 'ADMIN' : 'USER'),
        publishingAuthorized: Boolean(data.publishingAuthorized || data.isAdmin),
      };

      // Persistencia
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));

      setUser(normalizedUser);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error?.message ||
          'No se pudo conectar con el servidor. Verifica que esté corriendo en http://localhost:8080',
      };
    }
  };

  /**
   * Función de registro
   * 
   * Conecta con el endpoint POST http://localhost:8080/users
   * 
   * @param {Object} userData - Datos del usuario { username, email, phone, password, confirmPassword, role }
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const register = async (userData) => {
    try {
      // Preparar datos para enviar al backend (sin confirmPassword)
      const requestData = {
        username: userData.username,
        email: userData.email,
        phone: userData.phone,
        password: userData.password,
        role: userData.role || 'USER', // Por defecto USER si no se especifica
      };

      // Enviar el token si existe: permite que un admin autenticado cree
      // usuarios con rol SHELTER/ADMIN. En el registro publico no hay token,
      // y el backend fuerza el rol USER.
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8080/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const backendMessage = errorData.message || errorData.error || errorData.detail || '';
        const duplicateEmail =
          backendMessage.toLowerCase().includes('users_email_key') ||
          backendMessage.toLowerCase().includes('duplicate key') ||
          backendMessage.toLowerCase().includes('already exists') ||
          backendMessage.toLowerCase().includes('correo ya fue registrado');

        if (duplicateEmail) {
          throw new Error('Este correo ya fue registrado');
        }

        throw new Error(
          backendMessage ||
          `Error al registrar usuario (${response.status})`
        );
      }

      const data = await response.json();

      // Si el backend devuelve token y datos de usuario, guardarlos
      // Si solo devuelve éxito, el usuario deberá hacer login después
      if (data.token) {
        const normalizedUser = {
          id: data.id || Date.now(),
          name: data.username || userData.username,
          username: data.username || userData.username,
          email: data.email || userData.email,
          phone: data.phone || userData.phone,
          isAdmin: data.isAdmin || data.role === 'ADMIN',
          role: data.role || userData.role || 'USER',
          publishingAuthorized: Boolean(data.publishingAuthorized || data.role === 'ADMIN' || data.role === 'SHELTER'),
        };

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(normalizedUser));
        setUser(normalizedUser);
      } else {
        // Si no devuelve token, solo indicamos éxito y el usuario deberá hacer login
        // No guardamos nada en localStorage aún
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error?.message ||
          'No se pudo conectar con el servidor. Verifica que esté corriendo en http://localhost:8080',
      };
    }
  };

  /**
   * Función de logout
   * 
   * TODO: Si el backend requiere invalidar el token, hacer llamada aquí
   * Ejemplo: POST /api/auth/logout con el token en headers
   */
  const logout = () => {
    // TODO: Opcionalmente, notificar al backend del logout
    // await fetch('/api/auth/logout', {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    // });
    
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  /**
   * Función para eliminar la cuenta del usuario
   * 
   * Conecta con el endpoint DELETE http://localhost:8080/users/{id}
   * 
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const deleteAccount = async () => {
    if (!user?.id) {
      return {
        success: false,
        error: 'No se pudo obtener el ID del usuario',
      };
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8080/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
          errorData.error ||
          `Error al eliminar la cuenta (${response.status})`
        );
      }

      // Si la eliminación fue exitosa, hacer logout y limpiar datos
      logout();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error?.message ||
          'No se pudo conectar con el servidor. Verifica que esté corriendo en http://localhost:8080',
      };
    }
  };

  /**
   * Función para actualizar los datos del usuario
   * 
   * Conecta con el endpoint PUT http://localhost:8080/users/update/{id}
   * Solo permite actualizar username y phone
   * 
   * @param {Object} userData - Datos a actualizar { username, phone }
   * @returns {Promise<{success: boolean, error?: string, user?: Object}>}
   */
  const updateUser = async (userData) => {
    if (!user?.id) {
      return {
        success: false,
        error: 'No se pudo obtener el ID del usuario',
      };
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8080/users/update/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          username: userData.username,
          phone: userData.phone,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
          errorData.error ||
          `Error al actualizar usuario (${response.status})`
        );
      }

      // Actualizar el usuario en el contexto y localStorage
      const updatedUser = {
        ...user,
        username: userData.username,
        name: userData.username, // También actualizamos name para mantener consistencia
        phone: userData.phone,
      };

      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);

      return { success: true, user: updatedUser };
    } catch (error) {
      return {
        success: false,
        error:
          error?.message ||
          'No se pudo conectar con el servidor. Verifica que esté corriendo en http://localhost:8080',
      };
    }
  };

  /**
   * Función para actualizar la contraseña del usuario
   * 
   * Conecta con el endpoint PUT http://localhost:8080/users/update/password/{id}
   * 
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const updatePassword = async (newPassword) => {
    if (!user?.id) {
      return {
        success: false,
        error: 'No se pudo obtener el ID del usuario',
      };
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8080/users/update/password/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          newPassword: newPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
          errorData.error ||
          `Error al actualizar contraseña (${response.status})`
        );
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error?.message ||
          'No se pudo conectar con el servidor. Verifica que esté corriendo en http://localhost:8080',
      };
    }
  };

  /**
   * Función para obtener los datos completos del usuario por email
   * 
   * Conecta con el endpoint GET http://localhost:8080/users/find/{mail}
   * 
   * @param {string} email - Email del usuario
   * @returns {Promise<{success: boolean, error?: string, user?: Object}>}
   */
  const getUserByEmail = async (email) => {
    if (!email) {
      return {
        success: false,
        error: 'El email es requerido',
      };
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8080/users/find/${email}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
          errorData.error ||
          `Error al obtener datos del usuario (${response.status})`
        );
      }

      const data = await response.json();

      // Normalizar los datos del usuario
      const normalizedUser = {
        id: data.id,
        username: data.username,
        name: data.username, // Para mantener consistencia con el frontend
        email: data.email,
        phone: data.phone || '',
        role: data.role,
        isAdmin: data.role === 'ADMIN',
        publishingAuthorized: Boolean(data.publishingAuthorized || data.role === 'ADMIN' || data.role === 'SHELTER'),
        accountActive: data.accountActive !== false,
      };

      return { success: true, user: normalizedUser };
    } catch (error) {
      return {
        success: false,
        error:
          error?.message ||
          'No se pudo conectar con el servidor. Verifica que esté corriendo en http://localhost:8080',
      };
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    deleteAccount,
    updateUser,
    updatePassword,
    getUserByEmail,
    isAuthenticated: !!user,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook para usar el contexto de autenticación
 * 
 * Uso:
 * const { user, login, logout, isAuthenticated } = useAuth();
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

export default AuthContext;
