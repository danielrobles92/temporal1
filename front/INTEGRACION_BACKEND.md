# Guía de Integración con Backend

Este documento describe cómo integrar el sistema de autenticación con tu backend.

## Estructura de la Integración

### 1. Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
REACT_APP_API_URL=http://localhost:3000/api
# O la URL de tu backend en producción
# REACT_APP_API_URL=https://api.tudominio.com/api
```

### 2. Endpoints Requeridos

#### Login
- **URL**: `POST /api/auth/login`
- **Body**:
  ```json
  {
    "email": "usuario@ejemplo.com",
    "password": "contraseña123"
  }
  ```
- **Response exitoso (200)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "Juan Pérez",
      "email": "usuario@ejemplo.com"
    }
  }
  ```
- **Response error (401/400)**:
  ```json
  {
    "message": "Credenciales inválidas"
  }
  ```

#### Registro
- **URL**: `POST /api/auth/register`
- **Body**:
  ```json
  {
    "name": "Juan Pérez",
    "email": "usuario@ejemplo.com",
    "password": "contraseña123"
  }
  ```
- **Response exitoso (201)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "Juan Pérez",
      "email": "usuario@ejemplo.com"
    }
  }
  ```
- **Response error (400)**:
  ```json
  {
    "message": "El email ya está registrado"
  }
  ```

#### Verificar Token (Opcional)
- **URL**: `GET /api/auth/verify`
- **Headers**: `Authorization: Bearer {token}`
- **Response exitoso (200)**:
  ```json
  {
    "valid": true,
    "user": {
      "id": 1,
      "name": "Juan Pérez",
      "email": "usuario@ejemplo.com"
    }
  }
  ```

#### Logout (Opcional)
- **URL**: `POST /api/auth/logout`
- **Headers**: `Authorization: Bearer {token}`
- **Response**: `204 No Content`

## Pasos de Implementación

### Paso 1: Actualizar AuthContext

1. Abre `src/context/AuthContext.js`
2. Busca las funciones `login` y `register`
3. Reemplaza el código de simulación con llamadas reales al backend

**Ejemplo de implementación con fetch:**

```javascript
const login = async (email, password) => {
  try {
    const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al iniciar sesión');
    }

    const data = await response.json();
    
    // Guardar token y usuario
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    setUser(data.user);
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error.message || 'Error al conectar con el servidor' 
    };
  }
};
```

### Paso 2: Configurar Interceptor de Requests (Opcional pero Recomendado)

Si usas axios, crea un archivo `src/utils/api.js`:

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

// Interceptor para agregar token a todas las requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores 401 (token inválido)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token inválido, hacer logout
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Paso 3: Verificar Token al Cargar la App

En `AuthContext.js`, actualiza el `useEffect`:

```javascript
useEffect(() => {
  const token = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');
  
  if (token && savedUser) {
    // Verificar token con backend
    fetch(`${process.env.REACT_APP_API_URL}/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.valid) {
          setUser(data.user);
        } else {
          // Token inválido, limpiar
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      })
      .catch(() => {
        // Error al verificar, limpiar
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      })
      .finally(() => {
        setLoading(false);
      });
  } else {
    setLoading(false);
  }
}, []);
```

## Manejo de Errores

### Errores Comunes

1. **401 Unauthorized**: Token inválido o expirado
   - Solución: Redirigir al login y limpiar localStorage

2. **403 Forbidden**: Usuario sin permisos
   - Solución: Mostrar mensaje de error apropiado

3. **400 Bad Request**: Datos inválidos
   - Solución: Mostrar mensajes de validación del backend

4. **500 Internal Server Error**: Error del servidor
   - Solución: Mostrar mensaje genérico y registrar error

### Ejemplo de Manejo de Errores

```javascript
try {
  const response = await fetch(...);
  
  if (!response.ok) {
    const errorData = await response.json();
    
    // Manejar diferentes códigos de error
    switch (response.status) {
      case 401:
        // Token inválido
        logout();
        return { success: false, error: 'Sesión expirada. Por favor, inicia sesión nuevamente.' };
      case 403:
        return { success: false, error: 'No tienes permisos para realizar esta acción.' };
      case 400:
        return { success: false, error: errorData.message || 'Datos inválidos.' };
      default:
        return { success: false, error: 'Error del servidor. Por favor, intenta más tarde.' };
    }
  }
  
  // Procesar respuesta exitosa
  const data = await response.json();
  return { success: true, data };
} catch (error) {
  // Error de red u otro error
  return { 
    success: false, 
    error: 'Error de conexión. Verifica tu conexión a internet.' 
  };
}
```

## Seguridad

### Buenas Prácticas

1. **Nunca almacenes contraseñas en localStorage**
   - Solo almacena el token JWT

2. **Usa HTTPS en producción**
   - Los tokens deben transmitirse solo por conexiones seguras

3. **Implementa expiración de tokens**
   - Verifica la expiración del token antes de hacer requests

4. **Limpia datos al hacer logout**
   - Elimina token y datos de usuario del localStorage

5. **Valida tokens en el backend**
   - No confíes solo en la validación del frontend

## Testing

### Probar la Integración

1. **Login exitoso**:
   - Ingresa credenciales válidas
   - Verifica que se guarde el token
   - Verifica que se redirija correctamente

2. **Login fallido**:
   - Ingresa credenciales inválidas
   - Verifica que se muestre el mensaje de error

3. **Registro exitoso**:
   - Completa el formulario correctamente
   - Verifica que se cree la cuenta y se inicie sesión automáticamente

4. **Token expirado**:
   - Simula un token expirado
   - Verifica que se redirija al login

## Notas Adicionales

- Los comentarios `TODO` en el código indican dónde hacer cambios
- Mantén la estructura de respuesta del backend consistente con lo esperado
- Considera implementar refresh tokens para mejor UX
- Documenta cualquier cambio en la estructura de respuesta del backend
