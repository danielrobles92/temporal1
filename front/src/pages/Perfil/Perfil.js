import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createAuthorizationRequest, getAuthorizationRequestsByUser } from '../../services/platformService';
import './Perfil.css';

const Perfil = () => {
  const navigate = useNavigate();
  const { user, deleteAccount, updateUser, updatePassword, getUserByEmail } = useAuth();
  
  // Estado del formulario
  const [formData, setFormData] = useState({
    username: '',
    phone: '',
    email: '',
    ubicacion: '',
    bio: '',
    imagen: null
  });

  // Estado para cambio de contraseña
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const [errores, setErrores] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [loadingUserData, setLoadingUserData] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState('');
  const [authorizationStatus, setAuthorizationStatus] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Cargar datos del usuario al montar el componente
  useEffect(() => {
    const loadUserData = async () => {
      if (user && user.email) {
        setLoadingUserData(true);
        const result = await getUserByEmail(user.email);
        setLoadingUserData(false);

        if (result.success && result.user) {
          // Actualizar el usuario en el contexto si es necesario
          // Los datos se cargan en el formulario
          setFormData({
            username: result.user.username || '',
            phone: result.user.phone || '',
            email: result.user.email || '',
            ubicacion: user.ubicacion || '', // Mantener datos locales que no vienen del backend
            bio: user.bio || '', // Mantener datos locales que no vienen del backend
            imagen: user.imagen || null // Mantener datos locales que no vienen del backend
          });
        } else {
          // Si falla la carga, usar los datos del contexto
          setFormData({
            username: user.username || user.name || '',
            phone: user.phone || '',
            email: user.email || '',
            ubicacion: user.ubicacion || '',
            bio: user.bio || '',
            imagen: user.imagen || null
          });
          if (result.error) {
            setErrores({ general: result.error });
          }
        }
      } else if (user) {
        // Si no hay email, usar los datos del contexto
        setFormData({
          username: user.username || user.name || '',
          phone: user.phone || '',
          email: user.email || '',
          ubicacion: user.ubicacion || '',
          bio: user.bio || '',
          imagen: user.imagen || null
        });
      }
    };

    loadUserData();
  }, [user, getUserByEmail]);

  useEffect(() => {
    const loadAuthorization = async () => {
      if (!user?.id) return;
      try {
        const items = await getAuthorizationRequestsByUser(user.id);
        const latest = (items || [])[items.length - 1];
        if (latest) setAuthorizationStatus(latest.status);
      } catch (error) {
        // El perfil sigue siendo util aunque no cargue este apartado.
      }
    };
    loadAuthorization();
  }, [user?.id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    // Limpiar errores cuando el usuario empieza a escribir
    if (errores[name]) {
      setErrores({
        ...errores,
        [name]: ''
      });
    }
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tamaño de archivo (máx 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrores({
          ...errores,
          imagen: 'La imagen no debe superar los 5MB'
        });
        return;
      }
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        setErrores({
          ...errores,
          imagen: 'El archivo debe ser una imagen'
        });
        return;
      }
      setFormData({
        ...formData,
        imagen: file
      });
      if (errores.imagen) {
        setErrores({
          ...errores,
          imagen: ''
        });
      }
    }
  };

  const validateForm = () => {
    const nuevosErrores = {};

    if (!formData.username.trim()) {
      nuevosErrores.username = 'El nombre de usuario es requerido';
    } else if (formData.username.trim().length < 2) {
      nuevosErrores.username = 'El nombre de usuario debe tener al menos 2 caracteres';
    }

    if (formData.phone && !/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
      nuevosErrores.phone = 'El teléfono no es válido';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const validatePasswordForm = () => {
    const nuevosErrores = {};

    if (!passwordData.newPassword.trim()) {
      nuevosErrores.newPassword = 'La nueva contraseña es requerida';
    } else if (passwordData.newPassword.length < 6) {
      nuevosErrores.newPassword = 'La contraseña debe tener al menos 6 caracteres';
    }

    if (!passwordData.confirmPassword.trim()) {
      nuevosErrores.confirmPassword = 'Confirma la contraseña';
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      nuevosErrores.confirmPassword = 'Las contraseñas no coinciden';
    }

    setPasswordErrors(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const result = await updateUser({
        username: formData.username,
        phone: formData.phone,
      });

      if (result.success) {
        setSuccessMessage('Perfil actualizado exitosamente');
        setEditMode(false);
        
        // Recargar datos del servidor para asegurar que tenemos la información más actualizada
        if (user && user.email) {
          const reloadResult = await getUserByEmail(user.email);
          if (reloadResult.success && reloadResult.user) {
            setFormData({
              username: reloadResult.user.username || '',
              phone: reloadResult.user.phone || '',
              email: reloadResult.user.email || '',
              ubicacion: user.ubicacion || '',
              bio: user.bio || '',
              imagen: user.imagen || null
            });
          }
        }
      } else {
        setErrores({ general: result.error || 'Error al actualizar el perfil' });
      }
    } catch (error) {
      setErrores({ general: error.message || 'Error al actualizar el perfil' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    // Recargar datos del servidor
    setErrores({});
    setSuccessMessage('');
    setEditMode(false);

    if (user && user.email) {
      setLoadingUserData(true);
      const result = await getUserByEmail(user.email);
      setLoadingUserData(false);

      if (result.success && result.user) {
        setFormData({
          username: result.user.username || '',
          phone: result.user.phone || '',
          email: result.user.email || '',
          ubicacion: user.ubicacion || '',
          bio: user.bio || '',
          imagen: user.imagen || null
        });
      } else {
        // Si falla, usar datos del contexto
        if (user) {
          setFormData({
            username: user.username || user.name || '',
            phone: user.phone || '',
            email: user.email || '',
            ubicacion: user.ubicacion || '',
            bio: user.bio || '',
            imagen: user.imagen || null
          });
        }
      }
    } else if (user) {
      setFormData({
        username: user.username || user.name || '',
        phone: user.phone || '',
        email: user.email || '',
        ubicacion: user.ubicacion || '',
        bio: user.bio || '',
        imagen: user.imagen || null
      });
    }
  };

  const handleChangePassword = () => {
    setShowPasswordModal(true);
    setPasswordData({ newPassword: '', confirmPassword: '' });
    setPasswordErrors({});
    setPasswordSuccessMessage('');
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData({
      ...passwordData,
      [name]: value
    });
    // Limpiar errores cuando el usuario empieza a escribir
    if (passwordErrors[name]) {
      setPasswordErrors({
        ...passwordErrors,
        [name]: ''
      });
    }
    if (passwordSuccessMessage) {
      setPasswordSuccessMessage('');
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordSuccessMessage('');

    if (!validatePasswordForm()) {
      return;
    }

    setPasswordLoading(true);

    try {
      const result = await updatePassword(passwordData.newPassword);

      if (result.success) {
        setPasswordSuccessMessage('Contraseña actualizada exitosamente');
        setPasswordData({ newPassword: '', confirmPassword: '' });
        // Cerrar el modal después de 2 segundos
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordSuccessMessage('');
        }, 2000);
      } else {
        setPasswordErrors({ general: result.error || 'Error al actualizar la contraseña' });
      }
    } catch (error) {
      setPasswordErrors({ general: error.message || 'Error al actualizar la contraseña' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handlePasswordCancel = () => {
    setShowPasswordModal(false);
    setPasswordData({ newPassword: '', confirmPassword: '' });
    setPasswordErrors({});
    setPasswordSuccessMessage('');
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const result = await deleteAccount();
    setDeleting(false);

    if (result.success) {
      // La función deleteAccount ya hace logout, solo redirigimos
      navigate('/login');
    } else {
      setErrores({ general: result.error || 'Error al eliminar la cuenta' });
      setShowDeleteModal(false);
    }
  };

  const handleAuthorizationRequest = async () => {
    try {
      await createAuthorizationRequest({
        userId: user.id,
        reason: 'Deseo publicar perros en adopcion dentro de la plataforma.',
      });
      setAuthorizationStatus('PENDING');
      setSuccessMessage('Solicitud de autorizacion enviada');
    } catch (error) {
      setErrores({ general: error.message || 'No se pudo enviar la solicitud de autorizacion' });
    }
  };

  if (!user) {
    return (
      <div className="perfil-page">
        <div className="error-message">
          <h2>Error</h2>
          <p>No se pudo cargar la información del usuario.</p>
          <button onClick={() => navigate('/home')} className="btn btn-primary">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="perfil-page">
      <div className="perfil-header">
        <h1>Mi Perfil</h1>
        <p>Gestiona tu información personal</p>
      </div>

      {successMessage && (
        <div className="success-alert">
          <span className="success-icon">✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      {errores.general && (
        <div className="error-alert">
          <span className="error-icon">⚠️</span>
          <span>{errores.general}</span>
        </div>
      )}

      <div className="perfil-container">
        <div className="perfil-sidebar">
          <div className="perfil-avatar-section">
            <div className="avatar-container">
              {formData.imagen ? (
                typeof formData.imagen === 'string' ? (
                  <img src={formData.imagen} alt={formData.username} className="avatar-image" />
                ) : (
                  <img 
                    src={URL.createObjectURL(formData.imagen)} 
                    alt={formData.username} 
                    className="avatar-image" 
                  />
                )
              ) : (
                <div className="avatar-placeholder">
                  <span className="avatar-initial">
                    {formData.username?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
              )}
            </div>
            {editMode && (
              <label className="avatar-upload-btn">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                Cambiar Foto
              </label>
            )}
            {errores.imagen && (
              <span className="error-message">{errores.imagen}</span>
            )}
          </div>

          <div className="perfil-stats">
            <h3>Estadísticas</h3>
            <div className="stat-item">
              <span className="stat-label">Anuncios Publicados</span>
              <span className="stat-value">0</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Mascotas Adoptadas</span>
              <span className="stat-value">0</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Mascotas Encontradas</span>
              <span className="stat-value">0</span>
            </div>
          </div>
        </div>

        <div className="perfil-content">
          {!editMode ? (
            <div className="perfil-view">
              <div className="perfil-info-section">
                <div className="info-header">
                  <h2>Información Personal</h2>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setEditMode(true)}
                  >
                    Editar Perfil
                  </button>
                </div>

                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Nombre de Usuario</span>
                    <span className="info-value">{formData.username || 'No especificado'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Email</span>
                    <span className="info-value">{formData.email || 'No especificado'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Teléfono</span>
                    <span className="info-value">{formData.phone || 'No especificado'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Ubicación</span>
                    <span className="info-value">{formData.ubicacion || 'No especificado'}</span>
                  </div>
                </div>

                {formData.bio && (
                  <div className="bio-section">
                    <h3>Biografía</h3>
                    <p>{formData.bio}</p>
                  </div>
                )}
              </div>

              <div className="perfil-actions">
                {!user?.publishingAuthorized && user?.role !== 'SHELTER' && !user?.isAdmin && (
                  <button 
                    className="btn btn-secondary"
                    onClick={handleAuthorizationRequest}
                    disabled={authorizationStatus === 'PENDING'}
                  >
                    {authorizationStatus === 'PENDING' ? 'Autorizacion pendiente' : 'Solicitar permiso para publicar'}
                  </button>
                )}
                <button 
                  className="btn btn-primary"
                  onClick={handleChangePassword}
                >
                  Cambiar Contraseña
                </button>
                <button 
                  className="btn btn-danger"
                  onClick={() => setShowDeleteModal(true)}
                >
                  Eliminar Cuenta
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="perfil-form">
              <div className="form-section">
                <h2>Información Personal</h2>
                
                <div className="form-group">
                  <label htmlFor="username">Nombre de Usuario *</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className={errores.username ? 'error' : ''}
                    placeholder="Tu nombre de usuario"
                    disabled={loading}
                  />
                  {errores.username && <span className="error-message">{errores.username}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={errores.email ? 'error' : ''}
                    placeholder="tu@email.com"
                    disabled={true}
                    title="El email no se puede modificar desde aquí"
                  />
                  <small style={{ color: '#666', fontSize: '0.85rem' }}>
                    El email no se puede modificar
                  </small>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="phone">Teléfono</label>
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

                  <div className="form-group">
                    <label htmlFor="ubicacion">Ubicación</label>
                    <input
                      type="text"
                      id="ubicacion"
                      name="ubicacion"
                      value={formData.ubicacion}
                      onChange={handleChange}
                      placeholder="Ciudad, Provincia"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="bio">Biografía</label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    rows="4"
                    placeholder="Cuéntanos sobre ti..."
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Modal de confirmación para eliminar cuenta */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Eliminar Cuenta</h2>
            </div>
            <div className="modal-body">
              <p>
                ¿Estás seguro de que deseas eliminar tu cuenta? Esta acción no se puede deshacer.
                Se eliminarán todos tus datos y anuncios asociados.
              </p>
              <p className="modal-warning">
                <strong>⚠️ Esta acción es permanente</strong>
              </p>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? 'Eliminando...' : 'Sí, Eliminar Cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para cambiar contraseña */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => !passwordLoading && handlePasswordCancel()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cambiar Contraseña</h2>
            </div>
            <div className="modal-body">
              {passwordSuccessMessage && (
                <div className="success-alert">
                  <span className="success-icon">✓</span>
                  <span>{passwordSuccessMessage}</span>
                </div>
              )}
              {passwordErrors.general && (
                <div className="error-alert">
                  <span className="error-icon">⚠️</span>
                  <span>{passwordErrors.general}</span>
                </div>
              )}
              <form onSubmit={handlePasswordSubmit}>
                <div className="form-group">
                  <label htmlFor="newPassword">Nueva Contraseña *</label>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    className={passwordErrors.newPassword ? 'error' : ''}
                    placeholder="Ingresa tu nueva contraseña"
                    disabled={passwordLoading}
                  />
                  {passwordErrors.newPassword && (
                    <span className="error-message">{passwordErrors.newPassword}</span>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirmar Contraseña *</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    className={passwordErrors.confirmPassword ? 'error' : ''}
                    placeholder="Confirma tu nueva contraseña"
                    disabled={passwordLoading}
                  />
                  {passwordErrors.confirmPassword && (
                    <span className="error-message">{passwordErrors.confirmPassword}</span>
                  )}
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handlePasswordCancel}
                    disabled={passwordLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? 'Actualizando...' : 'Actualizar Contraseña'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Perfil;
