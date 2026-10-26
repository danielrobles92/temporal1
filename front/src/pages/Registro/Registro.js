import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import './Registro.css';

const Registro = () => {
  const navigate = useNavigate();
  const { register, user } = useAuth();
  const { showToast } = useToast();
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'USER', // Por defecto USER, puede ser USER o ADMIN
  });

  const [errores, setErrores] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');

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
      nuevosErrores.confirmPassword = 'Confirma tu contraseña';
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

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    // TODO: Esta función register() está definida en AuthContext
    // Cuando integres con el backend, la función register en AuthContext
    // hará la llamada real al endpoint POST /api/auth/register
    const result = await register(formData);

    setLoading(false);

    if (result.success) {
      // Redirigir al usuario después del registro exitoso a la pantalla principal
      showToast('Registro completado correctamente. Ya puedes iniciar sesion.', 'success');
      navigate('/login');
    } else {
      const message = result.error || 'Error al registrar usuario. Por favor, intenta de nuevo.';
      setErrorGeneral(message);
      showToast(message, 'error');
    }
  };

  return (
    <div className="registro-page">
      <div className="registro-container auth-card">
        <div className="registro-header">
          <h1>Crear Cuenta</h1>
          <p>Únete a Perreque y ayuda a las mascotas</p>
        </div>

        <form onSubmit={handleSubmit} className="registro-form">
          {errorGeneral && (
            <div className="error-alert">
              <span className="error-icon">⚠️</span>
              <span>{errorGeneral}</span>
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

          {/* Solo mostrar selector de rol si el usuario actual es administrador */}
          {user && user.isAdmin && (
            <div className="form-group">
              <label htmlFor="role">Tipo de Usuario</label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                disabled={loading}
                className="select-role"
              >
                <option value="USER">Usuario</option>
                <option value="ADMIN">Administrador</option>
              </select>
              <small className="role-hint">Solo los administradores pueden crear otros administradores</small>
            </div>
          )}

          <div className="form-terms">
            <label className="checkbox-label">
              <input type="checkbox" required />
              <span>
                Acepto los{' '}
                <Link to="/terminos" className="link-terms">
                  términos y condiciones
                </Link>{' '}
                y la{' '}
                <Link to="/privacidad" className="link-terms">
                  política de privacidad
                </Link>
              </span>
            </label>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-submit"
            disabled={loading}
          >
            {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>

          <div className="form-footer">
            <p>
              ¿Ya tienes una cuenta?{' '}
              <Link to="/login" className="link-login">
                Inicia sesión aquí
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Registro;
