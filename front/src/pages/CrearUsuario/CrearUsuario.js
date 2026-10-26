import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './CrearUsuario.css';

const CrearUsuario = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { showToast } = useToast();
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'USER', // USER, SHELTER o ADMIN
  });

  const [errores, setErrores] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    // Limpiar errores cuando el usuario empieza a escribir
    if (errores[name]) {
      setErrores({
        ...errores,
        [name]: '',
      });
    }
    if (errorGeneral) {
      setErrorGeneral('');
    }
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const validateForm = () => {
    const nuevosErrores = {};

    if (!formData.username.trim()) {
      nuevosErrores.username = 'El nombre de usuario es requerido';
    } else if (formData.username.trim().length < 3) {
      nuevosErrores.username = 'El nombre de usuario debe tener al menos 3 caracteres';
    }

    if (!formData.email.trim()) {
      nuevosErrores.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      nuevosErrores.email = 'El email no es válido';
    }

    if (!formData.phone.trim()) {
      nuevosErrores.phone = 'El teléfono es requerido';
    } else if (!/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
      nuevosErrores.phone = 'El teléfono no es válido';
    }

    if (!formData.password) {
      nuevosErrores.password = 'La contraseña es requerida';
    } else if (formData.password.length < 6) {
      nuevosErrores.password = 'La contraseña debe tener al menos 6 caracteres';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      nuevosErrores.password = 'La contraseña debe contener mayúsculas, minúsculas y números';
    }

    if (!formData.confirmPassword) {
      nuevosErrores.confirmPassword = 'Confirma la contraseña';
    } else if (formData.password !== formData.confirmPassword) {
      nuevosErrores.confirmPassword = 'Las contraseñas no coinciden';
    }

    setErrores(nuevosErrores);
    const firstError = Object.values(nuevosErrores)[0];
    if (firstError) showToast(firstError, 'error');
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorGeneral('');
    setSuccessMessage('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    const result = await register(formData);

    setLoading(false);

    if (result.success) {
      const message = `Usuario ${formData.role === 'ADMIN' ? 'administrador' : formData.role === 'SHELTER' ? 'refugio' : 'normal'} creado exitosamente`;
      setSuccessMessage(message);
      showToast(message, 'success');
      // Limpiar el formulario después de 2 segundos
      setTimeout(() => {
        setFormData({
          username: '',
          email: '',
          phone: '',
          password: '',
          confirmPassword: '',
          role: 'USER',
        });
        setSuccessMessage('');
      }, 3000);
    } else {
      setErrorGeneral(result.error || 'Error al crear usuario. Por favor, intenta de nuevo.');
      showToast(result.error || 'Error al crear usuario', 'error');
    }
  };

  return (
    <div className="crear-usuario-page">
      <div className="crear-usuario-container auth-card">
        <div className="crear-usuario-header">
          <h1>Crear Nuevo Usuario</h1>
          <p>Como administrador, puedes crear nuevos usuarios y definir su rol</p>
        </div>

        <form onSubmit={handleSubmit} className="crear-usuario-form">
          {errorGeneral && (
            <div className="error-alert">
              <span className="error-icon">⚠️</span>
              <span>{errorGeneral}</span>
            </div>
          )}

          {successMessage && (
            <div className="success-alert">
              <span className="success-icon">✓</span>
              <span>{successMessage}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Nombre de Usuario *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className={errores.username ? 'error' : ''}
              placeholder="juanperez"
              disabled={loading}
            />
            {errores.username && <span className="error-message">{errores.username}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errores.email ? 'error' : ''}
              placeholder="tu@email.com"
              disabled={loading}
            />
            {errores.email && <span className="error-message">{errores.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="phone">Teléfono *</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={errores.phone ? 'error' : ''}
              placeholder="+34 123 456 789"
              disabled={loading}
            />
            {errores.phone && <span className="error-message">{errores.phone}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Contraseña *</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={errores.password ? 'error' : ''}
                placeholder="••••••••"
                disabled={loading}
              />
              {errores.password && <span className="error-message">{errores.password}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirmar Contraseña *</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={errores.confirmPassword ? 'error' : ''}
                placeholder="••••••••"
                disabled={loading}
              />
              {errores.confirmPassword && <span className="error-message">{errores.confirmPassword}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="role">Tipo de Usuario *</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              disabled={loading}
              className="select-role"
            >
              <option value="USER">Usuario Normal</option>
              <option value="SHELTER">Refugio</option>
              <option value="ADMIN">Administrador</option>
            </select>
            <small className="role-hint">
              Selecciona el rol que tendrá el nuevo usuario en el sistema
            </small>
          </div>

          <div className="form-actions">
            <button 
              type="button"
              onClick={() => navigate('/home')}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-primary btn-submit"
              disabled={loading}
            >
              {loading ? 'Creando usuario...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CrearUsuario;
