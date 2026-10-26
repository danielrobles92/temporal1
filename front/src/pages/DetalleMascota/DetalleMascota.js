import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPetDetails, deletePet, mapBackendToFrontend } from '../../services/petsService';
import { createAdoptionRequest, getPetMatches } from '../../services/platformService';
import CartillaView from '../../components/CartillaView/CartillaView';
import BreedRecommendations from '../../components/BreedRecommendations/BreedRecommendations';
import MatchSuggestions from '../../components/MatchSuggestions/MatchSuggestions';
import './DetalleMascota.css';

const ADOPTION_FORM_INITIAL = {
  nombreCompleto: '',
  correo: '',
  telefono: '',
  ocupacion: '',
  tipoVivienda: '',
  otrasMascotas: '',
  motivoAdopcion: '',
  compromisoCuidado: '',
};

const buildAdoptionMessage = (form) => {
  const parts = [
    form.motivoAdopcion && `Motivo de adopción:\n${form.motivoAdopcion}`,
    form.compromisoCuidado && `Compromiso de cuidado:\n${form.compromisoCuidado}`,
    form.ocupacion && `Ocupación: ${form.ocupacion}`,
    form.tipoVivienda && `Tipo de vivienda: ${form.tipoVivienda}`,
    form.otrasMascotas && `¿Tiene otras mascotas?: ${form.otrasMascotas}`,
  ].filter(Boolean);
  return parts.join('\n\n');
};

const DetalleMascota = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [mascota, setMascota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAdoptionModal, setShowAdoptionModal] = useState(false);
  const [showContactRefugio, setShowContactRefugio] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [adoptionForm, setAdoptionForm] = useState(ADOPTION_FORM_INITIAL);
  const [deleting, setDeleting] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [petMatches, setPetMatches] = useState([]);

  // Sugerencias de la red neuronal para publicaciones de perro perdido:
  // compara sus fotos contra los reportes de perros encontrados.
  useEffect(() => {
    if (mascota?.estado === 'perdida' && id) {
      getPetMatches(id).then(setPetMatches).catch(() => setPetMatches([]));
    }
  }, [mascota?.estado, id]);

  useEffect(() => {
    const loadPetDetails = async () => {
      try {
        setLoading(true);
        setError('');
        const petData = await getPetDetails(id);
        const mappedPet = mapBackendToFrontend(petData);
        setMascota(mappedPet);
        setActiveImage(0);
      } catch (err) {
        setError(err.message || 'Error al cargar los detalles de la mascota');
        console.error('Error al cargar detalles de la mascota:', err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadPetDetails();
    }
  }, [id]);

  useEffect(() => {
    if (user) {
      setAdoptionForm((prev) => ({
        ...prev,
        nombreCompleto: prev.nombreCompleto || user.name || user.username || '',
        correo: prev.correo || user.email || '',
        telefono: prev.telefono || user.phone || '',
      }));
    }
  }, [user]);

  const handleDeletePet = async () => {
    setDeleting(true);
    try {
      await deletePet(id);
      navigate('/home');
    } catch (err) {
      setError(err.message || 'Error al eliminar la mascota');
      setShowDeleteModal(false);
      console.error('Error al eliminar mascota:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleAdoptionFormChange = (e) => {
    const { name, value } = e.target;
    setAdoptionForm((prev) => ({ ...prev, [name]: value }));
  };

  const openAdoptionForm = () => {
    setShowAdoptionModal(true);
  };

  const handleAdoptionRequest = async (e) => {
    e.preventDefault();
    if (mascota?.ownerId && user?.id && Number(mascota.ownerId) === Number(user.id)) {
      setError('No puedes solicitar adopcion de tu propia publicacion');
      return;
    }
    setSendingRequest(true);
    setError('');
    try {
      await createAdoptionRequest({
        petId: Number(id),
        userId: user?.id,
        contactName: adoptionForm.nombreCompleto || user?.name || user?.username || 'Usuario',
        contactEmail: adoptionForm.correo || user?.email,
        contactPhone: adoptionForm.telefono || user?.phone || '',
        message: buildAdoptionMessage(adoptionForm),
      });
      setShowAdoptionModal(false);
      setAdoptionForm(ADOPTION_FORM_INITIAL);
    } catch (err) {
      setError(err.message || 'Error al registrar la solicitud de adopcion');
    } finally {
      setSendingRequest(false);
    }
  };

  if (loading) {
    return (
      <div className="detalle-mascota">
        <div className="loading-container">
          <div className="loading-spinner">Cargando detalles de la mascota...</div>
        </div>
      </div>
    );
  }

  if (error && !mascota) {
    return (
      <div className="detalle-mascota">
        <div className="error-message">
          <h2>Mascota no encontrada</h2>
          <p>{error || 'La mascota que buscas no existe o ha sido eliminada.'}</p>
          <button onClick={() => navigate('/home')} className="btn btn-primary">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (!mascota) {
    return null;
  }

  const isAdopcion = mascota.estado === 'adopcion';
  const isOwner = Number(mascota.ownerId) === Number(user?.id);
  const canRequestAdoption = isAdopcion && !isOwner && !user?.isAdmin;
  const galleryImages =
    mascota.imagenes?.length > 0
      ? mascota.imagenes
      : mascota.imagen
        ? [mascota.imagen]
        : [];
  const estadoSaludDisplay = mascota.estadoSalud || 'No especificado';
  const refugioLabel = mascota.ownerName
    ? `Refugio ${mascota.ownerName}`
    : 'Refugio publicador';

  const detalleFilas = [
    { label: 'Raza', value: mascota.raza },
    { label: 'Edad', value: mascota.edad },
    { label: 'Sexo', value: mascota.sexo },
    { label: 'Tamaño', value: mascota.tamano },
    { label: 'Ubicación', value: mascota.ubicacion },
    { label: 'Estado de salud', value: estadoSaludDisplay },
  ].filter((row) => row.value);

  if (isAdopcion && !user?.isAdmin) {
    return (
      <div className="detalle-mascota detalle-mascota--adopcion">
        <button type="button" onClick={() => navigate(-1)} className="btn-back">
          ← Volver
        </button>

        {error && (
          <div className="error-alert detalle-adopcion-alert">
            <span>{error}</span>
          </div>
        )}

        <div className="detalle-adopcion-card">
          <div className="detalle-adopcion-galeria">
            <div className="detalle-adopcion-imagen-principal">
              {galleryImages.length > 0 ? (
                <img src={galleryImages[activeImage]} alt={mascota.nombre} />
              ) : (
                <div className="imagen-placeholder">
                  <span className="placeholder-icon-large">🐕</span>
                </div>
              )}
            </div>
            {galleryImages.length > 1 && (
              <div className="detalle-adopcion-thumbs">
                {galleryImages.slice(0, 4).map((src, index) => (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    className={`detalle-adopcion-thumb ${activeImage === index ? 'active' : ''}`}
                    onClick={() => setActiveImage(index)}
                  >
                    <img src={src} alt={`${mascota.nombre} ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="detalle-adopcion-info">
            <div className="detalle-adopcion-titulo">
              <h1>{mascota.nombre}</h1>
              <div className="detalle-adopcion-badges">
                <span className="detalle-badge detalle-badge--disponible">Disponible</span>
                {mascota.ownerName && (
                  <span className="detalle-badge detalle-badge--refugio">{refugioLabel}</span>
                )}
              </div>
            </div>

            <dl className="detalle-adopcion-datos">
              {detalleFilas.map((row) => (
                <div key={row.label} className="detalle-adopcion-fila">
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>

            {mascota.descripcion && (
              <p className="detalle-adopcion-descripcion">{mascota.descripcion}</p>
            )}

            <CartillaView cartilla={mascota.cartilla} />

            {canRequestAdoption && (
              <>
                <div className="detalle-adopcion-acciones">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={openAdoptionForm}
                  >
                    Solicitar adopción
                  </button>
                  <button type="button" className="btn btn-secondary btn-favorito">
                    Guardar favorito
                  </button>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => setShowContactRefugio((v) => !v)}
                  >
                    Contactar refugio
                  </button>
                </div>

                {showContactRefugio && (
                  <div className="detalle-refugio-contacto">
                    <h3>Datos de contacto del refugio</h3>
                    <p>
                      <strong>Nombre:</strong>{' '}
                      {mascota.ownerName || 'No disponible'}
                    </p>
                    <p>
                      <strong>Correo:</strong>{' '}
                      {mascota.ownerEmail ? (
                        <a href={`mailto:${mascota.ownerEmail}`}>{mascota.ownerEmail}</a>
                      ) : (
                        'No disponible'
                      )}
                    </p>
                    <p>
                      <strong>Teléfono:</strong>{' '}
                      {mascota.ownerPhone ? (
                        <a href={`tel:${mascota.ownerPhone}`}>{mascota.ownerPhone}</a>
                      ) : (
                        'No disponible'
                      )}
                    </p>
                    <div className="detalle-refugio-raza">
                      <BreedRecommendations breed={mascota.raza} />
                    </div>
                  </div>
                )}

                <p className="detalle-adopcion-aviso">
                  Antes de solicitar la adopción, el usuario debe iniciar sesión y completar su
                  formulario de interés.
                </p>
              </>
            )}
          </div>
        </div>

        {showAdoptionModal && (
          <div
            className="modal-overlay"
            onClick={() => !sendingRequest && setShowAdoptionModal(false)}
          >
            <div
              className="modal-content adopcion-solicitud-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Solicitud de adopción</h2>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowAdoptionModal(false)}
                  disabled={sendingRequest}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleAdoptionRequest} className="adopcion-solicitud-form">
                <div className="adopcion-solicitud-grid">
                  <div className="form-group">
                    <label htmlFor="nombreCompleto">Nombre completo</label>
                    <input
                      id="nombreCompleto"
                      name="nombreCompleto"
                      type="text"
                      value={adoptionForm.nombreCompleto}
                      onChange={handleAdoptionFormChange}
                      placeholder="Escribe tu nombre"
                      disabled={sendingRequest}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="correo">Correo electrónico</label>
                    <input
                      id="correo"
                      name="correo"
                      type="email"
                      value={adoptionForm.correo}
                      onChange={handleAdoptionFormChange}
                      placeholder="correo@ejemplo.com"
                      disabled={sendingRequest}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="telefono">Teléfono</label>
                    <input
                      id="telefono"
                      name="telefono"
                      type="tel"
                      value={adoptionForm.telefono}
                      onChange={handleAdoptionFormChange}
                      placeholder="55 1234 5678"
                      disabled={sendingRequest}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="ocupacion">Ocupación</label>
                    <input
                      id="ocupacion"
                      name="ocupacion"
                      type="text"
                      value={adoptionForm.ocupacion}
                      onChange={handleAdoptionFormChange}
                      placeholder="Ej. Estudiante, profesionista"
                      disabled={sendingRequest}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="tipoVivienda">Tipo de vivienda</label>
                    <select
                      id="tipoVivienda"
                      name="tipoVivienda"
                      value={adoptionForm.tipoVivienda}
                      onChange={handleAdoptionFormChange}
                      disabled={sendingRequest}
                    >
                      <option value="">Selecciona una opción</option>
                      <option value="Casa">Casa</option>
                      <option value="Departamento">Departamento</option>
                      <option value="Con patio">Con patio</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="otrasMascotas">¿Tienes otras mascotas?</label>
                    <select
                      id="otrasMascotas"
                      name="otrasMascotas"
                      value={adoptionForm.otrasMascotas}
                      onChange={handleAdoptionFormChange}
                      disabled={sendingRequest}
                    >
                      <option value="">Selecciona una opción</option>
                      <option value="No">No</option>
                      <option value="Sí, perros">Sí, perros</option>
                      <option value="Sí, gatos">Sí, gatos</option>
                      <option value="Sí, otros">Sí, otros</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="motivoAdopcion">Motivo de adopción</label>
                  <textarea
                    id="motivoAdopcion"
                    name="motivoAdopcion"
                    value={adoptionForm.motivoAdopcion}
                    onChange={handleAdoptionFormChange}
                    rows="4"
                    placeholder="Cuéntanos por qué quieres adoptar a esta mascota"
                    disabled={sendingRequest}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="compromisoCuidado">Compromiso de cuidado</label>
                  <textarea
                    id="compromisoCuidado"
                    name="compromisoCuidado"
                    value={adoptionForm.compromisoCuidado}
                    onChange={handleAdoptionFormChange}
                    rows="4"
                    placeholder="Describe cómo cuidarías al perro, tiempo disponible, espacio, alimentación, etc."
                    disabled={sendingRequest}
                  />
                </div>

                <div className="adopcion-solicitud-actions">
                  <button type="submit" className="btn btn-primary" disabled={sendingRequest}>
                    {sendingRequest ? 'Enviando...' : 'Enviar solicitud'}
                  </button>
                  <button type="button" className="btn btn-secondary btn-guardar-borrador">
                    Guardar borrador
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="detalle-mascota">
      <button type="button" onClick={() => navigate(-1)} className="btn-back">
        ← Volver
      </button>

      <div className="detalle-container">
        <div className="detalle-imagen">
          {mascota.imagen ? (
            <img src={mascota.imagen} alt={mascota.nombre} />
          ) : (
            <div className="imagen-placeholder">
              <span className="placeholder-icon-large">🐾</span>
            </div>
          )}
        </div>

        <div className="detalle-info">
          <div className="detalle-header">
            <h1>{mascota.nombre}</h1>
            <span className={`badge ${mascota.estado}`}>
              {mascota.estado === 'adopcion' ? 'En Adopción' : 'Perdida'}
            </span>
          </div>

          <div className="detalle-datos">
            <div className="dato-item">
              <span className="dato-label">Tipo:</span>
              <span className="dato-valor">{mascota.tipo}</span>
            </div>
            {mascota.raza && (
              <div className="dato-item">
                <span className="dato-label">Raza:</span>
                <span className="dato-valor">{mascota.raza}</span>
              </div>
            )}
            {mascota.sexo && (
              <div className="dato-item">
                <span className="dato-label">Sexo:</span>
                <span className="dato-valor">{mascota.sexo}</span>
              </div>
            )}
            {mascota.color && (
              <div className="dato-item">
                <span className="dato-label">Color:</span>
                <span className="dato-valor">{mascota.color}</span>
              </div>
            )}
            {mascota.edad && (
              <div className="dato-item">
                <span className="dato-label">Edad:</span>
                <span className="dato-valor">{mascota.edad}</span>
              </div>
            )}
            {isAdopcion && (
              <div className="dato-item">
                <span className="dato-label">Estado de salud:</span>
                <span className="dato-valor">{estadoSaludDisplay}</span>
              </div>
            )}
            <div className="dato-item">
              <span className="dato-label">Ubicación:</span>
              <span className="dato-valor">{mascota.ubicacion}</span>
            </div>
            {mascota.ownerName && (
              <div className="dato-item">
                <span className="dato-label">Publicado por:</span>
                <span className="dato-valor">{mascota.ownerName}</span>
              </div>
            )}
          </div>

          {mascota.descripcion && (
            <div className="detalle-descripcion">
              <h3>Descripción</h3>
              <p>{mascota.descripcion}</p>
            </div>
          )}

          {isAdopcion && <CartillaView cartilla={mascota.cartilla} />}

          {mascota.estado === 'perdida' && (
            <div className="detalle-descripcion">
              <h3>Posibles coincidencias (perros encontrados)</h3>
              <MatchSuggestions matches={petMatches} />
            </div>
          )}

          <div className="detalle-contacto">
            <h3>Información</h3>
            {user?.isAdmin ? (
              <>
                <p className="contacto-note">
                  Como administrador, puedes editar o eliminar la información de esta mascota.
                </p>
                <div className="admin-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-action"
                    onClick={() => navigate(`/mascota/${id}/editar`)}
                  >
                    Editar Información
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-action"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    Eliminar Mascota
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="contacto-note">
                  {isAdopcion
                    ? 'Si estás interesado en adoptar a esta mascota, puedes contactar a través de los canales oficiales de Perreque cuando estén disponibles.'
                    : 'Si has visto a esta mascota, por favor reporta el avistamiento a través de los canales oficiales de Perreque cuando estén disponibles.'}
                </p>
                {canRequestAdoption && (
                  <button
                    type="button"
                    className="btn btn-primary btn-action"
                    onClick={openAdoptionForm}
                  >
                    Solicitar adopcion
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Eliminar Mascota</h2>
            </div>
            <div className="modal-body">
              <p>
                ¿Estás seguro de que deseas eliminar a <strong>{mascota?.nombre}</strong>? Esta
                acción no se puede deshacer.
              </p>
              <p className="modal-warning">
                <strong>⚠️ Esta acción es permanente</strong>
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeletePet}
                disabled={deleting}
              >
                {deleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdoptionModal && (
        <div
          className="modal-overlay"
          onClick={() => !sendingRequest && setShowAdoptionModal(false)}
        >
          <div
            className="modal-content adopcion-solicitud-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Solicitud de adopción</h2>
            </div>
            <form onSubmit={handleAdoptionRequest} className="adopcion-solicitud-form modal-body">
              <div className="adopcion-solicitud-grid">
                <div className="form-group">
                  <label htmlFor="nombreCompleto-admin">Nombre completo</label>
                  <input
                    id="nombreCompleto-admin"
                    name="nombreCompleto"
                    type="text"
                    value={adoptionForm.nombreCompleto}
                    onChange={handleAdoptionFormChange}
                    placeholder="Escribe tu nombre"
                    disabled={sendingRequest}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="correo-admin">Correo electrónico</label>
                  <input
                    id="correo-admin"
                    name="correo"
                    type="email"
                    value={adoptionForm.correo}
                    onChange={handleAdoptionFormChange}
                    placeholder="correo@ejemplo.com"
                    disabled={sendingRequest}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="telefono-admin">Teléfono</label>
                  <input
                    id="telefono-admin"
                    name="telefono"
                    type="tel"
                    value={adoptionForm.telefono}
                    onChange={handleAdoptionFormChange}
                    placeholder="55 1234 5678"
                    disabled={sendingRequest}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="ocupacion-admin">Ocupación</label>
                  <input
                    id="ocupacion-admin"
                    name="ocupacion"
                    type="text"
                    value={adoptionForm.ocupacion}
                    onChange={handleAdoptionFormChange}
                    placeholder="Ej. Estudiante, profesionista"
                    disabled={sendingRequest}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="tipoVivienda-admin">Tipo de vivienda</label>
                  <select
                    id="tipoVivienda-admin"
                    name="tipoVivienda"
                    value={adoptionForm.tipoVivienda}
                    onChange={handleAdoptionFormChange}
                    disabled={sendingRequest}
                  >
                    <option value="">Selecciona una opción</option>
                    <option value="Casa">Casa</option>
                    <option value="Departamento">Departamento</option>
                    <option value="Con patio">Con patio</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="otrasMascotas-admin">¿Tienes otras mascotas?</label>
                  <select
                    id="otrasMascotas-admin"
                    name="otrasMascotas"
                    value={adoptionForm.otrasMascotas}
                    onChange={handleAdoptionFormChange}
                    disabled={sendingRequest}
                  >
                    <option value="">Selecciona una opción</option>
                    <option value="No">No</option>
                    <option value="Sí, perros">Sí, perros</option>
                    <option value="Sí, gatos">Sí, gatos</option>
                    <option value="Sí, otros">Sí, otros</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="motivoAdopcion-admin">Motivo de adopción</label>
                <textarea
                  id="motivoAdopcion-admin"
                  name="motivoAdopcion"
                  value={adoptionForm.motivoAdopcion}
                  onChange={handleAdoptionFormChange}
                  rows="4"
                  placeholder="Cuéntanos por qué quieres adoptar a esta mascota"
                  disabled={sendingRequest}
                />
              </div>
              <div className="form-group">
                <label htmlFor="compromisoCuidado-admin">Compromiso de cuidado</label>
                <textarea
                  id="compromisoCuidado-admin"
                  name="compromisoCuidado"
                  value={adoptionForm.compromisoCuidado}
                  onChange={handleAdoptionFormChange}
                  rows="4"
                  placeholder="Describe cómo cuidarías al perro, tiempo disponible, espacio, alimentación, etc."
                  disabled={sendingRequest}
                />
              </div>
              <div className="modal-actions adopcion-solicitud-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAdoptionModal(false)}
                  disabled={sendingRequest}
                >
                  Cancelar
                </button>
                <button type="button" className="btn btn-secondary btn-guardar-borrador">
                  Guardar borrador
                </button>
                <button type="submit" className="btn btn-primary" disabled={sendingRequest}>
                  {sendingRequest ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetalleMascota;
