import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  const location = useLocation();

  // No mostrar footer en páginas de login/registro
  if (location.pathname === '/login' || location.pathname === '/registro') {
    return null;
  }

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-section">
          <h3>Perreque</h3>
          <p>Conectando mascotas con familias que las necesitan.</p>
        </div>
        
        <div className="footer-section">
          <h4>Enlaces</h4>
          <Link to="/adopcion">Adopción</Link>
          <Link to="/mascotas-perdidas">Mascotas Perdidas</Link>
          <Link to="/publicar">Publicar Anuncio</Link>
        </div>
        
        <div className="footer-section">
          <h4>Contacto</h4>
          <p>Email: contacto@perreque.com</p>
          <p>Teléfono: +123 456 789</p>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Perreque. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
};

export default Footer;

