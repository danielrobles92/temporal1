import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Home.css';

const Home = () => {
  const { user } = useAuth();
  
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            Encuentra tu compañero perfecto
          </h1>
          <p className="hero-subtitle">
            Conectamos mascotas que necesitan un hogar con familias que las amarán.
            También ayudamos a reunir mascotas perdidas con sus dueños.
          </p>
          <div className="hero-buttons">
            <Link to="/adopcion" className="btn btn-primary">
              Ver Mascotas en Adopción
            </Link>
            <Link to="/mascotas-perdidas" className="btn btn-secondary">
              Mascotas Perdidas
            </Link>
          </div>
        </div>
      </section>

      <section className="features">
        <h2 className="section-title">¿Cómo funciona?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Busca</h3>
            <p>Explora nuestra base de datos de mascotas disponibles para adopción o reportadas como perdidas.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3>Publica</h3>
            <p>Publica un anuncio de adopción o reporta una mascota perdida para ayudar a encontrarla.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">💚</div>
            <h3>Adopta</h3>
            <p>Conecta con familias que están buscando dar un hogar lleno de amor a una mascota.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🏠</div>
            <h3>Reúne</h3>
            <p>Ayuda a reunir mascotas perdidas con sus dueños mediante nuestro sistema de búsqueda.</p>
          </div>
        </div>
      </section>

      {/* Solo mostrar sección de publicar si el usuario es administrador */}
      {user?.isAdmin && (
        <section className="cta-section">
          <div className="cta-content">
            <h2>¿Tienes una mascota para dar en adopción?</h2>
            <p>O tal vez encontraste una mascota perdida. ¡Ayúdanos a conectar con las personas correctas!</p>
            <Link to="/publicar" className="btn btn-primary btn-large">
              Publicar Anuncio
            </Link>
          </div>
        </section>
      )}
    </div>
  );
};

export default Home;

