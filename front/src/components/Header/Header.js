import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getNotificationSummary,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../services/platformService';
import './Header.css';

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [notifications, setNotifications] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setNotifications(null);
      setAlerts([]);
      return undefined;
    }

    let active = true;
    const loadNotifications = async () => {
      try {
        const [summary, list] = await Promise.all([
          getNotificationSummary(user.id).catch(() => null),
          getNotifications(user.id).catch(() => []),
        ]);
        if (active) {
          setNotifications(summary);
          setAlerts(list || []);
        }
      } catch (error) {
        if (active) setNotifications(null);
      }
    };

    loadNotifications();
    const intervalId = setInterval(loadNotifications, 30000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [isAuthenticated, user?.id]);

  const unreadCount = alerts.filter((a) => !a.read).length;

  const openAlert = async (alert) => {
    setShowAlerts(false);
    if (!alert.read) {
      try {
        await markNotificationRead(alert.notificationId);
        setAlerts((prev) => prev.map((a) => (a.notificationId === alert.notificationId ? { ...a, read: true } : a)));
      } catch (e) { /* no-op */ }
    }
    if (alert.link) navigate(alert.link);
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead(user.id);
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    } catch (e) { /* no-op */ }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    setShowMenu(false);
  };

  // No mostrar header en páginas de login/registro
  if (location.pathname === '/login' || location.pathname === '/registro') {
    return null;
  }

  return (
    <header className="header">
      <div className="header-container">
        <Link to={isAuthenticated ? "/home" : "/login"} className="logo">
          <span className="logo-icon">🐾</span>
          <span className="logo-text">Perreque</span>
        </Link>
        
        <nav className="navigation">
          {isAuthenticated && (
            <>
              <Link 
                to="/home" 
                className={`nav-link ${location.pathname === '/home' ? 'active' : ''}`}
              >
                Inicio
              </Link>
              <Link 
                to="/adopcion" 
                className={`nav-link ${location.pathname === '/adopcion' ? 'active' : ''}`}
              >
                Adopción
              </Link>
              <Link 
                to="/mascotas-perdidas" 
                className={`nav-link ${location.pathname === '/mascotas-perdidas' ? 'active' : ''}`}
              >
                Mascotas Perdidas
              </Link>
              <Link
                to="/casos"
                className={`nav-link nav-link-with-badge ${location.pathname === '/casos' ? 'active' : ''}`}
              >
                Casos
                {notifications?.openCases > 0 && <span className="nav-badge">{notifications.openCases}</span>}
              </Link>
              {(user?.isAdmin || user?.role === 'SHELTER' || user?.publishingAuthorized) && (
                <Link 
                  to="/publicar" 
                  className={`nav-link nav-link-primary ${location.pathname === '/publicar' ? 'active' : ''}`}
                >
                  Publicar Anuncio
                </Link>
              )}
            </>
          )}

          {isAuthenticated && (
            <div className="notif-bell">
              <button
                className="notif-bell-button"
                onClick={() => setShowAlerts((v) => !v)}
                aria-label="Notificaciones"
              >
                <span className="notif-bell-icon">🔔</span>
                {unreadCount > 0 && <span className="notif-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              {showAlerts && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown-head">
                    <strong>Notificaciones</strong>
                    {unreadCount > 0 && (
                      <button className="notif-markall" onClick={handleMarkAll}>Marcar todas leídas</button>
                    )}
                  </div>
                  {alerts.length === 0 ? (
                    <p className="notif-empty">No tienes notificaciones.</p>
                  ) : (
                    <ul className="notif-list">
                      {alerts.map((a) => (
                        <li
                          key={a.notificationId}
                          className={`notif-item ${a.read ? '' : 'unread'}`}
                          onClick={() => openAlert(a)}
                        >
                          <span className="notif-item-title">{a.title}</span>
                          {a.message && <span className="notif-item-msg">{a.message}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {isAuthenticated ? (
            <div className="user-menu">
              <button
                className="user-menu-button"
                onClick={() => setShowMenu(!showMenu)}
                aria-label="Menú de usuario"
              >
                <span className="user-avatar">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
                <span className="user-name">{user?.name || 'Usuario'}</span>
                <span className="menu-arrow">▼</span>
              </button>
              
              {showMenu && (
                <div className="user-dropdown">
                  <Link 
                    to="/perfil" 
                    className="dropdown-item"
                    onClick={() => setShowMenu(false)}
                  >
                    Mi Perfil
                  </Link>
                  <Link 
                    to="/mis-anuncios" 
                    className="dropdown-item"
                    onClick={() => setShowMenu(false)}
                  >
                    Mis Anuncios
                  </Link>
                  <Link
                    to="/solicitudes"
                    className="dropdown-item"
                    onClick={() => setShowMenu(false)}
                  >
                    Solicitudes
                    {notifications?.adoptionRequests > 0 && <span className="dropdown-badge">{notifications.adoptionRequests}</span>}
                  </Link>
                  <Link
                    to="/casos"
                    className="dropdown-item"
                    onClick={() => setShowMenu(false)}
                  >
                    Casos
                    {notifications?.openCases > 0 && <span className="dropdown-badge">{notifications.openCases}</span>}
                  </Link>
                  {notifications?.reportSightings > 0 && (
                    <Link
                      to="/mis-anuncios?tab=avisos"
                      className="dropdown-item"
                      onClick={() => setShowMenu(false)}
                    >
                      Avisos recibidos
                      <span className="dropdown-badge">{notifications.reportSightings}</span>
                    </Link>
                  )}
                  {/* Solo mostrar opción de crear usuario si es administrador */}
                  {user?.isAdmin && (
                    <>
                      <div className="dropdown-divider"></div>
                      <Link 
                        to="/admin" 
                        className="dropdown-item"
                        onClick={() => setShowMenu(false)}
                      >
                        Administracion
                      </Link>
                      <Link 
                        to="/crear-usuario" 
                        className="dropdown-item"
                        onClick={() => setShowMenu(false)}
                      >
                        Crear Usuario
                      </Link>
                    </>
                  )}
                  <div className="dropdown-divider"></div>
                  <button 
                    className="dropdown-item dropdown-item-danger"
                    onClick={handleLogout}
                  >
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </nav>
      </div>
    </header>
  );
};

export default Header;

