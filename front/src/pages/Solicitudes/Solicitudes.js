import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import BreedRecommendations from '../../components/BreedRecommendations/BreedRecommendations';
import {
  cancelAdoptionRequest,
  createAdoptionCase,
  decideAdoptionRequest,
  getAdoptionRequestsByOwner,
  getAdoptionRequestsByUser,
} from '../../services/platformService';
import './Solicitudes.css';

const statusMeta = {
  PENDING: { label: 'Pendiente', tone: 'pending' },
  APPROVED: { label: 'En contacto', tone: 'approved' },
  REJECTED: { label: 'Cancelada', tone: 'rejected' },
};

const getRequestMeta = (request) => {
  if (request?.decisionNotes === 'ADOPTED') return { label: 'Adoptado', tone: 'approved' };
  if (request?.decisionNotes?.startsWith?.('CANCELLED')) return { label: 'Cancelada', tone: 'rejected' };
  return statusMeta[request?.status] || { label: request?.status, tone: 'pending' };
};

const decisionNoteLabel = {
  CONTACT_CASE_OPENED: 'Caso de adopcion abierto para contacto.',
  ADOPTED: 'El perro fue marcado como adoptado.',
  CANCELLED_BY_OWNER: 'La solicitud fue cancelada por el publicador.',
  CANCELLED_AFTER_CONTACT: 'El caso fue cancelado despues del contacto.',
};

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
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

const RequestCard = ({ request, onContact, onDecision, onCancel, onOpenDetails }) => {
  const meta = getRequestMeta(request);
  const petTitle = request.petName || 'Mascota sin nombre';
  const mode = request.viewMode;

  return (
    <article className={`request-card request-card-${meta.tone}`} onClick={() => onOpenDetails(request)}>
      <div className="request-card-top">
        {request.petImageUrl && (
          <img className="request-pet-image" src={request.petImageUrl} alt={petTitle} />
        )}
        <div>
          <span className="request-eyebrow">{mode === 'received' ? 'Solicitud recibida' : 'Solicitud realizada'}</span>
          <h3>{mode === 'received' ? petTitle : petTitle}</h3>
          {mode === 'received' && <small>Solicitante: {request.contactName}</small>}
          {request.petOwnerName && <small>Refugio/publicador: {request.petOwnerName}</small>}
        </div>
        <span className={`status-pill ${meta.tone}`}>{meta.label}</span>
      </div>

      <div className="request-meta-grid">
        <div>
          <span>Publicacion</span>
          <strong>{petTitle}</strong>
        </div>
        <div>
          <span>Fecha</span>
          <strong>{formatDate(request.createdAt)}</strong>
        </div>
      </div>

      <p className="request-message">{request.message || 'Sin mensaje adicional.'}</p>

      {mode === 'received' && (
        <div className="request-contact">
          <span>{request.contactEmail}</span>
          {request.contactPhone && <span>{request.contactPhone}</span>}
        </div>
      )}

      {request.decisionNotes && <p className="request-notes">{decisionNoteLabel[request.decisionNotes] || request.decisionNotes}</p>}

      {mode === 'received' && request.status === 'PENDING' && (
        <div className="request-actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-primary" onClick={() => onContact(request)}>Contactar</button>
          <button className="btn btn-danger" onClick={() => onDecision(request.requestId, 'REJECTED', 'CANCELLED_BY_OWNER')}>Cancelar</button>
        </div>
      )}

      {mode === 'mine' && request.status === 'PENDING' && (
        <div className="request-actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-secondary" onClick={() => onCancel(request.requestId)}>Cancelar solicitud</button>
        </div>
      )}
    </article>
  );
};

const Solicitudes = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [mine, setMine] = useState([]);
  const [received, setReceived] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  // Solicitud a punto de contactarse: antes se muestran las recomendaciones de la raza.
  const [contactRequest, setContactRequest] = useState(null);
  const [openingCase, setOpeningCase] = useState(false);

  const canReview = user?.isAdmin || user?.role === 'SHELTER' || user?.publishingAuthorized;

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const ownRequests = await getAdoptionRequestsByUser(user.id);
      setMine(ownRequests || []);
      if (canReview) {
        const ownerRequests = await getAdoptionRequestsByOwner(user.id);
        setReceived(ownerRequests || []);
      }
    } catch (err) {
      const message = err.message || 'No se pudieron cargar las solicitudes';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const stats = useMemo(() => ({
    minePending: mine.filter((request) => request.status === 'PENDING').length,
    receivedPending: received.filter((request) => request.status === 'PENDING').length,
  }), [mine, received]);

  const allRequests = useMemo(() => ([
    ...mine.map((request) => ({ ...request, viewMode: 'mine', viewKey: `mine-${request.requestId}` })),
    ...received.map((request) => ({ ...request, viewMode: 'received', viewKey: `received-${request.requestId}` })),
  ]), [mine, received]);

  const filteredRequests = useMemo(() => {
    if (activeFilter === 'mine') return allRequests.filter((request) => request.viewMode === 'mine');
    if (activeFilter === 'received') return allRequests.filter((request) => request.viewMode === 'received');
    if (activeFilter === 'pending') return allRequests.filter((request) => request.status === 'PENDING');
    return allRequests;
  }, [activeFilter, allRequests]);

  const decide = async (requestId, status, notes = '') => {
    try {
      await decideAdoptionRequest(requestId, status, notes);
      showToast(notes === 'ADOPTED' ? 'Adopcion marcada como completada' : status === 'APPROVED' ? 'Caso de adopcion abierto' : 'Solicitud cancelada', 'success');
      setSelectedRequest(null);
      await load();
    } catch (err) {
      showToast(err.message || 'No se pudo actualizar la solicitud', 'error');
    }
  };

  const openAdoptionCase = async (requestId) => {
    setOpeningCase(true);
    try {
      const newCase = await createAdoptionCase(requestId);
      showToast('Caso de adopcion abierto', 'success');
      setSelectedRequest(null);
      setContactRequest(null);
      await load();
      navigate(`/casos?case=${newCase.caseId}`);
    } catch (err) {
      showToast(err.message || 'No se pudo abrir el caso de adopcion', 'error');
    } finally {
      setOpeningCase(false);
    }
  };

  const startContact = (request) => {
    setSelectedRequest(null);
    setContactRequest(request);
  };

  const cancel = async (requestId) => {
    try {
      await cancelAdoptionRequest(requestId, user.id);
      showToast('Solicitud cancelada', 'success');
      setSelectedRequest(null);
      await load();
    } catch (err) {
      showToast(err.message || 'No se pudo cancelar la solicitud', 'error');
    }
  };

  const selectedMeta = selectedRequest ? getRequestMeta(selectedRequest) : null;

  return (
    <div className="solicitudes-page">
      <div className="solicitudes-hero">
        <div>
          <span>Adopciones</span>
          <h1>Solicitudes</h1>
          <p>Revisa el avance de tus solicitudes y responde a los adoptantes interesados.</p>
        </div>
        <div className="solicitudes-stats">
          <button className={activeFilter === 'all' ? 'active' : ''} type="button" onClick={() => setActiveFilter('all')}>
            <strong>{allRequests.length}</strong><span>todas</span>
          </button>
          <button className={activeFilter === 'mine' ? 'active' : ''} type="button" onClick={() => setActiveFilter('mine')}>
            <strong>{mine.length}</strong><span>realizadas</span>
          </button>
          {canReview && (
            <button className={activeFilter === 'received' ? 'active' : ''} type="button" onClick={() => setActiveFilter('received')}>
              <strong>{received.length}</strong><span>recibidas</span>
            </button>
          )}
          <button className={activeFilter === 'pending' ? 'active' : ''} type="button" onClick={() => setActiveFilter('pending')}>
            <strong>{stats.minePending + stats.receivedPending}</strong><span>pendientes</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">Cargando solicitudes...</div>
      ) : error ? (
        <div className="error-alert">{error}</div>
      ) : (
        <div className="request-grid">
          {filteredRequests.length === 0 ? (
            <div className="empty-panel">
              <h2>No hay solicitudes para este filtro</h2>
              <p>Cuando exista movimiento, aparecera aqui con su estado y datos de contacto.</p>
            </div>
          ) : (
            filteredRequests.map((request) => (
              <RequestCard
                key={request.viewKey}
                request={request}
                onContact={startContact}
                onDecision={decide}
                onCancel={cancel}
                onOpenDetails={setSelectedRequest}
              />
            ))
          )}
        </div>
      )}

      {selectedRequest && (
        <div className="request-modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="request-modal" onClick={(e) => e.stopPropagation()}>
            <div className="request-modal-header">
              <div>
                <span>Detalle de solicitud</span>
                <h2>{selectedRequest.petName || 'Mascota sin nombre'}</h2>
              </div>
              <button type="button" onClick={() => setSelectedRequest(null)}>x</button>
            </div>

            <div className="request-modal-body">
              {selectedRequest.petImageUrl && (
                <img className="request-modal-image" src={selectedRequest.petImageUrl} alt={selectedRequest.petName || 'Mascota'} />
              )}
              <div className="request-detail-grid">
                <div><span>Estado</span><strong>{selectedMeta.label}</strong></div>
                <div><span>Fecha y hora</span><strong>{formatDateTime(selectedRequest.createdAt)}</strong></div>
                <div><span>Publicado por</span><strong>{selectedRequest.petOwnerName || 'No registrado'}</strong></div>
                <div><span>Solicitante</span><strong>{selectedRequest.contactName || 'No registrado'}</strong></div>
                <div><span>Correo</span><strong>{selectedRequest.contactEmail || 'No registrado'}</strong></div>
                <div><span>Telefono</span><strong>{selectedRequest.contactPhone || 'No registrado'}</strong></div>
              </div>

              {selectedRequest.status === 'APPROVED' && (
                <div className="adoption-case-board">
                  <span>Caso de adopcion abierto</span>
                <p>Usa estos datos para conectar al refugio/publicador con el solicitante. Aqui queda reunida la informacion del perro, quien publico y quien quiere adoptar.</p>
                  <div>
                    <strong>Perro:</strong> {selectedRequest.petName || 'Mascota sin nombre'}
                  </div>
                  <div>
                    <strong>Refugio/publicador:</strong> {selectedRequest.petOwnerName || 'No registrado'}
                  </div>
                  <div>
                    <strong>Solicitante:</strong> {selectedRequest.contactName || 'No registrado'} - {selectedRequest.contactEmail || 'Sin correo'}
                  </div>
                </div>
              )}

              <div className="request-modal-message">
                <span>Mensaje</span>
                <p>{selectedRequest.message || 'Sin mensaje adicional.'}</p>
              </div>

              {selectedRequest.decisionNotes && (
                <div className="request-modal-message">
                  <span>Notas de decision</span>
                  <p>{decisionNoteLabel[selectedRequest.decisionNotes] || selectedRequest.decisionNotes}</p>
                </div>
              )}
            </div>

            <div className="request-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedRequest(null)}>Cerrar</button>
              {selectedRequest.viewMode === 'mine' && selectedRequest.status === 'PENDING' && (
                <button type="button" className="btn btn-danger" onClick={() => cancel(selectedRequest.requestId)}>Cancelar solicitud</button>
              )}
              {selectedRequest.viewMode === 'received' && selectedRequest.status === 'PENDING' && (
                <>
                  <button type="button" className="btn btn-primary" onClick={() => startContact(selectedRequest)}>Contactar</button>
                  <button type="button" className="btn btn-danger" onClick={() => decide(selectedRequest.requestId, 'REJECTED', 'CANCELLED_BY_OWNER')}>Cancelar</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {contactRequest && (
        <div className="request-modal-overlay" onClick={() => !openingCase && setContactRequest(null)}>
          <div className="request-modal" onClick={(e) => e.stopPropagation()}>
            <div className="request-modal-header">
              <div>
                <span>Antes de contactar al solicitante</span>
                <h2>{contactRequest.petName || 'Mascota sin nombre'}{contactRequest.petBreed ? ` · ${contactRequest.petBreed}` : ''}</h2>
              </div>
              <button type="button" onClick={() => setContactRequest(null)} disabled={openingCase}>x</button>
            </div>

            <div className="request-modal-body">
              <p className="request-contact-intro">
                Revisa lo que dicen los estudios veterinarios sobre la raza y compáralo con lo que contó{' '}
                {contactRequest.contactName || 'el solicitante'} en su mensaje (vivienda, otras mascotas, tiempo).
              </p>
              <BreedRecommendations breed={contactRequest.petBreed} forShelter />
            </div>

            <div className="request-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setContactRequest(null)} disabled={openingCase}>Volver</button>
              <button type="button" className="btn btn-primary" onClick={() => openAdoptionCase(contactRequest.requestId)} disabled={openingCase}>
                {openingCase ? 'Abriendo caso...' : 'Abrir caso y contactar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Solicitudes;
