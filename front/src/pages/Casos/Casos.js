import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  addCaseMessage,
  getCaseDetails,
  getCasesByUser,
  updateCaseStatus,
} from '../../services/platformService';
import './Casos.css';

const statusLabel = {
  OPEN: 'Abierto',
  ADOPTED: 'Adoptado',
  CANCELLED: 'Cancelado',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
};

const typeLabel = {
  ADOPTION: 'Adopcion',
  LOST: 'Perro perdido',
};

const formatDateTime = (value) => {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const Casos = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [message, setMessage] = useState('');
  const [messageImages, setMessageImages] = useState([]);
  const [messagePreviews, setMessagePreviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await getCasesByUser(user.id);
      setCases(data || []);
      const query = new URLSearchParams(location.search);
      const caseId = query.get('case');
      if (caseId) {
        const detail = await getCaseDetails(caseId);
        setSelectedCase(detail);
      }
    } catch (err) {
      showToast(err.message || 'No se pudieron cargar los casos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id, location.search]);

  const filteredCases = useMemo(() => {
    if (filter === 'ALL') return cases;
    if (filter === 'OPEN') {
      return cases.filter((item) => !['ADOPTED', 'CANCELLED', 'RESOLVED', 'CLOSED'].includes(item.status));
    }
    if (filter === 'CLOSED') {
      return cases.filter((item) => ['ADOPTED', 'CANCELLED', 'RESOLVED', 'CLOSED'].includes(item.status));
    }
    return cases.filter((item) => item.caseType === filter);
  }, [cases, filter]);

  // Agrupar en secciones por tipo (Adopcion / Perros perdidos), en orden fijo.
  const groupedCases = useMemo(() => {
    const order = ['ADOPTION', 'LOST'];
    return order
      .map((type) => ({ type, items: filteredCases.filter((item) => item.caseType === type) }))
      .filter((group) => group.items.length > 0);
  }, [filteredCases]);

  const openCase = async (caseId) => {
    try {
      const detail = await getCaseDetails(caseId);
      setSelectedCase(detail);
      setMessage('');
      setMessageImages([]);
      setMessagePreviews([]);
    } catch (err) {
      showToast(err.message || 'No se pudo abrir el caso', 'error');
    }
  };

  const sendMessage = async () => {
    if (!selectedCase || (!message.trim() && messageImages.length === 0)) {
      showToast('Escribe un mensaje o adjunta fotos para el caso', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await addCaseMessage(selectedCase.caseId, user.id, message.trim(), messageImages);
      setSelectedCase(updated);
      setMessage('');
      setMessageImages([]);
      setMessagePreviews([]);
      await load();
      showToast('Mensaje enviado', 'success');
    } catch (err) {
      showToast(err.message || 'No se pudo enviar el mensaje', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMessageImagesChange = (event) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/')).slice(0, 4);

    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
      showToast('Cada foto debe pesar menos de 5 MB', 'warning');
      event.target.value = '';
      return;
    }

    setMessageImages(files);
    setMessagePreviews(files.map((file) => URL.createObjectURL(file)));
  };

  const clearMessageImages = () => {
    setMessageImages([]);
    setMessagePreviews([]);
  };

  const changeStatus = async (status, defaultMessage) => {
    if (!selectedCase) return;
    setActionLoading(true);
    try {
      const updated = await updateCaseStatus(selectedCase.caseId, status, user.id, message.trim() || defaultMessage);
      setSelectedCase(updated);
      setMessage('');
      await load();
      showToast('Caso actualizado', 'success');
    } catch (err) {
      showToast(err.message || 'No se pudo actualizar el caso', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="casos-page">
      <section className="casos-hero">
        <div>
          <span>Seguimiento</span>
          <h1>Casos</h1>
          <p>Centraliza conversaciones de adopcion y avisos de perros perdidos.</p>
        </div>
        <div className="casos-filters">
          {[
            ['ALL', 'Todos'],
            ['ADOPTION', 'Adopcion'],
            ['LOST', 'Perdidos'],
            ['OPEN', 'Abiertos'],
            ['CLOSED', 'Cerrados'],
          ].map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="loading-container">Cargando casos...</div>
      ) : filteredCases.length === 0 ? (
        <div className="casos-empty">
          <h2>Sin casos para este filtro</h2>
          <p>Cuando contactes por adopcion o abras un aviso de perro perdido, aparecera aqui.</p>
        </div>
      ) : (
        <div className="casos-sections">
          {groupedCases.map((group) => (
            <section key={group.type} className="casos-section">
              <h2 className="casos-section-title">
                {typeLabel[group.type] || group.type}
                <span className="casos-section-count">{group.items.length}</span>
              </h2>
              <div className="casos-grid">
                {group.items.map((item) => (
                  <article key={item.caseId} className="caso-card" onClick={() => openCase(item.caseId)}>
                    {item.imageUrl && <img src={item.imageUrl} alt={item.petName || item.title} />}
                    <div className="caso-card-body">
                      <div className="caso-card-top">
                        <span>{typeLabel[item.caseType] || item.caseType}</span>
                        <strong>{statusLabel[item.status] || item.status}</strong>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.lastMessage || 'Sin mensajes todavia.'}</p>
                      <small>{formatDateTime(item.updatedAt)}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {selectedCase && (
        <div className="caso-modal-overlay" onClick={() => setSelectedCase(null)}>
          <div className="caso-modal" onClick={(event) => event.stopPropagation()}>
            <div className="caso-modal-header">
              <div>
                <span>{typeLabel[selectedCase.caseType] || selectedCase.caseType}</span>
                <h2>{selectedCase.title}</h2>
              </div>
              <button type="button" onClick={() => setSelectedCase(null)}>x</button>
            </div>

            <div className="caso-modal-body">
              <aside className="caso-detail-panel">
                {selectedCase.imageUrl && <img src={selectedCase.imageUrl} alt={selectedCase.petName || selectedCase.title} />}
                <div><span>Estado</span><strong>{statusLabel[selectedCase.status] || selectedCase.status}</strong></div>
                <div><span>Perro</span><strong>{selectedCase.petName || 'No registrado'}</strong></div>
                <div><span>Ubicacion</span><strong>{selectedCase.location || 'No registrada'}</strong></div>
                <div><span>Publicador</span><strong>{selectedCase.ownerName || selectedCase.ownerEmail || 'No registrado'}</strong></div>
                <div><span>Contacto</span><strong>{selectedCase.participantName || selectedCase.participantEmail || 'No registrado'}</strong></div>
                {selectedCase.participantPhone && <div><span>Telefono</span><strong>{selectedCase.participantPhone}</strong></div>}
              </aside>

              <section className="caso-thread">
                <div className="caso-messages">
                  {(selectedCase.messages || []).length === 0 ? (
                    <p className="caso-message-empty">Sin mensajes todavia.</p>
                  ) : (
                    selectedCase.messages.map((item) => (
                      <div key={item.messageId} className={`caso-message ${item.senderId === user.id ? 'mine' : ''}`}>
                        <strong>{item.senderName || 'Contacto'}</strong>
                        <p>{item.message}</p>
                        {item.imageUrls?.length > 0 && (
                          <div className="caso-message-images">
                            {item.imageUrls.map((url, index) => (
                              <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">
                                <img src={url} alt={`Adjunto ${index + 1}`} />
                              </a>
                            ))}
                          </div>
                        )}
                        <span>{formatDateTime(item.createdAt)}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="caso-compose">
                  <textarea
                    rows="4"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Escribe actualizacion, punto de encuentro, dudas o cierre del caso"
                    disabled={actionLoading}
                  />
                  <div className="caso-attachment-row">
                    <label className="caso-attachment-picker">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleMessageImagesChange}
                        disabled={actionLoading}
                      />
                      Adjuntar fotos
                    </label>
                    {messageImages.length > 0 && (
                      <button type="button" className="caso-clear-attachments" onClick={clearMessageImages} disabled={actionLoading}>
                        Quitar fotos
                      </button>
                    )}
                  </div>
                  {messagePreviews.length > 0 && (
                    <div className="caso-attachment-previews">
                      {messagePreviews.map((url, index) => (
                        <img key={`${url}-${index}`} src={url} alt={`Foto por enviar ${index + 1}`} />
                      ))}
                    </div>
                  )}
                  <div className="caso-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setSelectedCase(null)} disabled={actionLoading}>Cerrar</button>
                    <button type="button" className="btn btn-primary" onClick={sendMessage} disabled={actionLoading}>Enviar mensaje</button>
                    {selectedCase.caseType === 'ADOPTION' && selectedCase.ownerId === user.id && (
                      <>
                        <button type="button" className="btn btn-success" onClick={() => changeStatus('ADOPTED', 'Adopcion completada.')} disabled={actionLoading}>Marcar adoptado</button>
                        <button type="button" className="btn btn-danger" onClick={() => changeStatus('CANCELLED', 'Caso de adopcion cancelado.')} disabled={actionLoading}>Cancelar caso</button>
                      </>
                    )}
                    {selectedCase.caseType === 'LOST' && selectedCase.ownerId === user.id && (
                      <>
                        <button type="button" className="btn btn-success" onClick={() => changeStatus('RESOLVED', 'Caso resuelto.')} disabled={actionLoading}>Caso resuelto</button>
                        <button type="button" className="btn btn-danger" onClick={() => changeStatus('CANCELLED', 'No era mi perro.')} disabled={actionLoading}>No es mi perro</button>
                      </>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Casos;
