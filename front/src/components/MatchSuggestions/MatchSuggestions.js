import React from 'react';
import './MatchSuggestions.css';

const confLevel = (c) => (c >= 0.7 ? 'high' : c >= 0.3 ? 'mid' : 'low');
const confText = (c) => (c >= 0.7 ? 'Muy probable' : c >= 0.3 ? 'Posible' : 'Poco probable');

/**
 * Lista compacta (solo lectura) de coincidencias potenciales: foto, nombre,
 * raza y % calibrado de ser el mismo perro. Se usa al publicar un reporte
 * para mostrar sugerencias antes de continuar.
 */
const MatchSuggestions = ({ matches }) => {
  if (!matches || matches.length === 0) {
    return (
      <p className="ms-empty">
        No encontramos coincidencias por ahora. Tu reporte queda publicado y revisaremos
        nuevas mascotas conforme se registren.
      </p>
    );
  }

  return (
    <div className="match-suggestions">
      {matches.map((m) => (
        <article key={m.matchId ?? `${m.reportId}-${m.petId}`} className="ms-card">
          {m.imageUrl ? (
            <img className="ms-thumb" src={m.imageUrl} alt={m.petName} />
          ) : (
            <div className="ms-thumb ms-thumb-empty">🐾</div>
          )}
          <div className="ms-body">
            <div className="ms-head">
              <strong>{m.petName}</strong>
              {m.breed && <span className="ms-breed">{m.breed}</span>}
            </div>
            {m.confidence != null ? (
              <div className={`ms-conf ${confLevel(m.confidence)}`}>
                <span className="ms-conf-pct">{Math.round(m.confidence * 100)}%</span>
                <span className="ms-conf-text">{confText(m.confidence)} · mismo perro</span>
              </div>
            ) : (
              <span className="ms-meta">Sin foto comparable</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
};

export default MatchSuggestions;
