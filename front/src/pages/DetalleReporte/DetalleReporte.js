import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getReportDetails, getReportMatches, updateMatchStatus } from '../../services/platformService';
import './DetalleReporte.css';

const typeLabel = {
  LOST: 'Perdido',
  FOUND: 'Encontrado',
};

const statusLabel = {
  OPEN: 'Abierto',
  RESOLVED: 'Resuelto',
};

const matchStatusLabel = {
  SUGGESTED: 'Sugerida',
  VALIDATED: 'Validada',
  REJECTED: 'Rechazada',
  DISCARDED: 'Descartada',
};

const confLevel = (c) => (c >= 0.7 ? 'high' : c >= 0.3 ? 'mid' : 'low');
const confText = (c) => (c >= 0.7 ? 'Muy probable' : c >= 0.3 ? 'Posible' : 'Poco probable');

const DetalleReporte = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingMatchId, setUpdatingMatchId] = useState(null);

  const handleMatchStatus = async (matchId, status) => {
    setUpdatingMatchId(matchId);
    try {
      const updated = await updateMatchStatus(matchId, status);
      setMatches((prev) =>
        prev.map((m) => (m.matchId === matchId ? { ...m, status: updated.status } : m))
      );
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la coincidencia');
    } finally {
      setUpdatingMatchId(null);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getReportDetails(id);
        setReport(data);
        const matchData = await getReportMatches(id).catch(() => []);
        setMatches(matchData || []);
      } catch (err) {
        setError(err.message || 'No se pudo cargar el reporte');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return <div className="loading-container">Cargando reporte...</div>;
  }

  if (error || !report) {
    return (
      <div className="detalle-reporte-page">
        <div className="empty-panel">
          <h2>Reporte no encontrado</h2>
          <p>{error || 'El reporte no existe o fue eliminado.'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/mascotas-perdidas')}>Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="detalle-reporte-page">
      <button onClick={() => navigate(-1)} className="btn-back">Volver</button>

      <section className="report-detail">
        <div className="report-media">
          {report.imageUrl ? (
            <img src={report.imageUrl} alt={report.name} />
          ) : (
            <div className="report-placeholder">Sin imagen</div>
          )}
          <span className={`report-badge ${report.type === 'FOUND' ? 'found' : 'lost'}`}>{typeLabel[report.type]}</span>
        </div>

        <div className="report-info">
          <div className="report-title-row">
            <div>
              <span className="report-kicker">Reporte #{report.reportId}</span>
              <h1>{report.name}</h1>
            </div>
            <span className="report-status">{statusLabel[report.status] || report.status}</span>
          </div>

          <div className="report-data-grid">
            <div><span>Raza</span><strong>{report.breed || 'No especificada'}</strong></div>
            <div><span>Sexo</span><strong>{report.sex === 'MALE' ? 'Macho' : report.sex === 'FEMALE' ? 'Hembra' : 'No especificado'}</strong></div>
            <div><span>Color</span><strong>{report.color || 'No especificado'}</strong></div>
            <div><span>Edad</span><strong>{report.age ? `${report.age} años` : 'No especificada'}</strong></div>
            <div><span>Contacto</span><strong>{report.contactPhone || 'No especificado'}</strong></div>
            <div><span>Ubicacion</span><strong>{report.location}</strong></div>
          </div>

          {report.description && (
            <div className="report-description">
              <h2>Descripcion</h2>
              <p>{report.description}</p>
            </div>
          )}

          {report.latitude && report.longitude && (
            <div className="report-map">
              <iframe
                title="Mapa del reporte"
                src={`https://maps.google.com/maps?q=${report.latitude},${report.longitude}&z=14&output=embed`}
                loading="lazy"
              />
            </div>
          )}
        </div>
      </section>

      <section className="matches-section">
        <h2>Coincidencias potenciales</h2>
        {matches.length === 0 ? (
          <p className="empty-text">No hay coincidencias potenciales registradas.</p>
        ) : (
          <div className="match-grid">
            {matches.map((match) => (
              <article
                key={match.matchId ?? `${match.reportId}-${match.petId}`}
                className={`match-card status-${(match.status || 'SUGGESTED').toLowerCase()}`}
              >
                {match.imageUrl && (
                  <img className="match-thumb" src={match.imageUrl} alt={match.petName} />
                )}
                <div className="match-head">
                  <strong>{match.petName}</strong>
                  <span className="match-status-badge">
                    {matchStatusLabel[match.status] || 'Sugerida'}
                  </span>
                </div>
                {match.breed && <span className="match-breed">🐾 {match.breed}</span>}
                {match.confidence != null ? (
                  <div className={`match-confidence ${confLevel(match.confidence)}`}>
                    <span className="match-confidence-pct">{Math.round(match.confidence * 100)}%</span>
                    <span className="match-confidence-text">{confText(match.confidence)} · mismo perro</span>
                  </div>
                ) : (
                  <span className="match-visual">Sin foto comparable</span>
                )}
                <span className="match-meta">
                  {match.score} pts
                  {match.visualScore != null && ` · ${Math.round(match.visualScore * 100)}% visual`}
                </span>
                <p>{match.reason || 'Coincidencia por atributos registrados.'}</p>
                {match.matchId && (
                  <div className="match-actions">
                    <button
                      className="btn btn-validate"
                      disabled={updatingMatchId === match.matchId || match.status === 'VALIDATED'}
                      onClick={() => handleMatchStatus(match.matchId, 'VALIDATED')}
                    >
                      Validar
                    </button>
                    <button
                      className="btn btn-reject"
                      disabled={updatingMatchId === match.matchId || match.status === 'REJECTED'}
                      onClick={() => handleMatchStatus(match.matchId, 'REJECTED')}
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default DetalleReporte;
