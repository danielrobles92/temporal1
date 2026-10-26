import React, { useEffect, useState } from 'react';
import MascotaCard from '../../components/MascotaCard/MascotaCard';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getAllPets, mapBackendToFrontend } from '../../services/petsService';
import { createAdoptionRequest } from '../../services/platformService';
import './Adopcion.css';

const SIZE_FETCH_ALL = 9999;
const VISIBLE_CARDS = 3;

const FILTROS_INICIALES = {
  busqueda: '',
  estado: 'AVAILABLE',
  sexo: '',
  tamano: '',
  edad: '',
  ubicacion: '',
};

const ADOPTION_FORM_INITIAL = {
  nombreCompleto: '',
  correo: '',
  telefono: '',
  mensaje: '',
};

const matchEdadFiltro = (edadNumero, filtroEdad) => {
  if (!filtroEdad) return true;
  if (edadNumero == null || edadNumero === '') return true;
  const age = Number(edadNumero);
  if (Number.isNaN(age)) return true;

  switch (filtroEdad) {
    case 'cachorro':
      return age <= 1;
    case 'joven':
      return age >= 2 && age <= 3;
    case 'adulto':
      return age >= 4 && age <= 7;
    case 'senior':
      return age >= 8;
    default:
      return true;
  }
};

const Adopcion = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [mascotas, setMascotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [mascotaDetalle, setMascotaDetalle] = useState(null);
  const [showAdoptionForm, setShowAdoptionForm] = useState(false);
  const [adoptionForm, setAdoptionForm] = useState(ADOPTION_FORM_INITIAL);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [filtrosDraft, setFiltrosDraft] = useState(FILTROS_INICIALES);
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);

  const loadPets = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getAllPets(SIZE_FETCH_ALL);
      const content = Array.isArray(response) ? response : (response.content || []);
      setMascotas(content.map((pet) => mapBackendToFrontend(pet)));
    } catch (err) {
      setError(err.message || 'Error al cargar las mascotas');
      console.error('Error al cargar mascotas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPets();
  }, []);

  const mascotasFiltradas = mascotas.filter((mascota) => {
    const coincideUbicacion =
      !filtros.ubicacion ||
      mascota.ubicacion?.toLowerCase().includes(filtros.ubicacion.toLowerCase());
    const coincideBusqueda =
      !filtros.busqueda ||
      mascota.nombre?.toLowerCase().includes(filtros.busqueda.toLowerCase()) ||
      (mascota.raza && mascota.raza.toLowerCase().includes(filtros.busqueda.toLowerCase()));
    const coincideSexo = !filtros.sexo || mascota.sexo === filtros.sexo;
    const coincideEdad = matchEdadFiltro(mascota.edadNumero, filtros.edad);
    const coincideEstado = !filtros.estado || mascota.estadoBackend === filtros.estado;

    return coincideUbicacion && coincideBusqueda && coincideSexo && coincideEdad && coincideEstado;
  });

  const maxCarouselIndex = Math.max(0, mascotasFiltradas.length - VISIBLE_CARDS);

  useEffect(() => {
    if (carouselIndex > maxCarouselIndex) {
      setCarouselIndex(maxCarouselIndex);
    }
  }, [carouselIndex, maxCarouselIndex]);

  useEffect(() => {
    if (!mascotaDetalle) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMascotaDetalle(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mascotaDetalle]);

  useEffect(() => {
    if (!mascotaDetalle) {
      setShowAdoptionForm(false);
      setAdoptionForm(ADOPTION_FORM_INITIAL);
      return;
    }

    setAdoptionForm({
      nombreCompleto: user?.name || user?.username || '',
      correo: user?.email || '',
      telefono: user?.phone || '',
      mensaje: '',
    });
  }, [mascotaDetalle, user]);

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltrosDraft((prev) => ({ ...prev, [name]: value }));
  };

  const aplicarFiltros = (e) => {
    e.preventDefault();
    setFiltros({ ...filtrosDraft });
    setCarouselIndex(0);
  };

  const limpiarFiltros = () => {
    setFiltrosDraft(FILTROS_INICIALES);
    setFiltros(FILTROS_INICIALES);
    setCarouselIndex(0);
  };

  const moverCarrusel = (direction) => {
    setCarouselIndex((current) => {
      const next = current + direction;
      return Math.min(maxCarouselIndex, Math.max(0, next));
    });
  };

  const handleAdoptionFormChange = (event) => {
    const { name, value } = event.target;
    setAdoptionForm((current) => ({ ...current, [name]: value }));
  };

  const handleAdoptionRequest = async (event) => {
    event.preventDefault();

    if (!mascotaDetalle || !user?.id) {
      showToast('Inicia sesion para solicitar adopcion', 'warning');
      return;
    }

    if (mascotaDetalle.ownerId && Number(mascotaDetalle.ownerId) === Number(user.id)) {
      showToast('No puedes solicitar adopcion de tu propia publicacion', 'warning');
      return;
    }

    setSendingRequest(true);
    try {
      await createAdoptionRequest({
        petId: Number(mascotaDetalle.id),
        userId: user.id,
        contactName: adoptionForm.nombreCompleto || user.name || user.username || 'Usuario',
        contactEmail: adoptionForm.correo || user.email,
        contactPhone: adoptionForm.telefono || user.phone || '',
        message: adoptionForm.mensaje || `Me interesa adoptar a ${mascotaDetalle.nombre || 'este perro'}.`,
      });
      showToast('Solicitud enviada correctamente', 'success');
      setShowAdoptionForm(false);
      setMascotaDetalle(null);
    } catch (err) {
      showToast(err.message || 'No se pudo enviar la solicitud', 'error');
    } finally {
      setSendingRequest(false);
    }
  };

  return (
    <div className="adopcion-page">
      <div className="adopcion-layout">
        <aside className="adopcion-filtros-card">
          <h2 className="adopcion-filtros-title">Filtros de busqueda</h2>
          <form className="adopcion-filtros-form" onSubmit={aplicarFiltros}>
            <div className="form-group">
              <label htmlFor="busqueda">Buscar por nombre o raza</label>
              <input
                id="busqueda"
                type="text"
                name="busqueda"
                className="adopcion-input"
                placeholder="Ej. Max, mestizo"
                value={filtrosDraft.busqueda}
                onChange={handleFiltroChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="estado">Estado</label>
              <select
                id="estado"
                name="estado"
                className="adopcion-input"
                value={filtrosDraft.estado}
                onChange={handleFiltroChange}
              >
                <option value="AVAILABLE">Disponibles</option>
                <option value="ADOPTED">Adoptados</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="sexo">Sexo</label>
              <select
                id="sexo"
                name="sexo"
                className="adopcion-input"
                value={filtrosDraft.sexo}
                onChange={handleFiltroChange}
              >
                <option value="">Todos</option>
                <option value="Macho">Macho</option>
                <option value="Hembra">Hembra</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="tamano">Tamano</label>
              <select
                id="tamano"
                name="tamano"
                className="adopcion-input adopcion-input--muted"
                value={filtrosDraft.tamano}
                onChange={handleFiltroChange}
                disabled
                title="Proximamente"
              >
                <option value="">Todos</option>
                <option value="Pequeno">Pequeno</option>
                <option value="Mediano">Mediano</option>
                <option value="Grande">Grande</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="edad">Edad aproximada</label>
              <select
                id="edad"
                name="edad"
                className="adopcion-input"
                value={filtrosDraft.edad}
                onChange={handleFiltroChange}
              >
                <option value="">Todas</option>
                <option value="cachorro">Cachorro (0-1 año)</option>
                <option value="joven">Joven (2-3 años)</option>
                <option value="adulto">Adulto (4-7 años)</option>
                <option value="senior">Senior (8+ años)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="ubicacion">Ubicacion</label>
              <input
                id="ubicacion"
                type="text"
                name="ubicacion"
                className="adopcion-input"
                placeholder="Ej. Iztapalapa"
                value={filtrosDraft.ubicacion}
                onChange={handleFiltroChange}
              />
            </div>

            <div className="adopcion-filtros-actions">
              <button type="submit" className="btn btn-primary btn-block">
                Aplicar filtros
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={limpiarFiltros}
              >
                Limpiar
              </button>
            </div>
          </form>
        </aside>

        <section className="adopcion-resultados">
          <div className="adopcion-resultados-header">
            {mascotasFiltradas.length > VISIBLE_CARDS ? (
              <button
                type="button"
                className="adopcion-carousel-side-button"
                onClick={() => moverCarrusel(-1)}
                disabled={carouselIndex === 0}
                aria-label="Ver perros anteriores"
              >
                Anterior
              </button>
            ) : (
              <span className="adopcion-carousel-side-spacer" />
            )}
            <h1>Mascotas disponibles</h1>
            {mascotasFiltradas.length > VISIBLE_CARDS ? (
              <button
                type="button"
                className="adopcion-carousel-side-button"
                onClick={() => moverCarrusel(1)}
                disabled={carouselIndex >= maxCarouselIndex}
                aria-label="Ver perros siguientes"
              >
                Siguiente
              </button>
            ) : (
              <span className="adopcion-carousel-side-spacer" />
            )}
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner">Cargando mascotas...</div>
            </div>
          ) : error ? (
            <div className="error-alert">
              <span className="error-icon">!</span>
              <span>{error}</span>
            </div>
          ) : mascotasFiltradas.length > 0 ? (
            <div className="adopcion-carousel">
              <div
                className="adopcion-carousel-track"
                style={{ transform: `translateX(calc(-${carouselIndex} * ((100% - 40px) / 3 + 20px)))` }}
              >
                {mascotasFiltradas.map((mascota) => (
                  <div className="adopcion-carousel-slide" key={mascota.id}>
                        <MascotaCard
                          mascota={mascota}
                          variant="adopcion"
                          onDetalle={setMascotaDetalle}
                        />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="adopcion-mascotas-grid">
              <div className="no-results">
                {mascotas.length === 0 ? (
                  <p>No hay perros disponibles.</p>
                ) : (
                  <>
                    <p>No se encontraron mascotas con esos filtros.</p>
                    <p>Intenta ajustar tus criterios de busqueda.</p>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {mascotaDetalle && (
        <div className="adopcion-modal-overlay" onClick={() => setMascotaDetalle(null)}>
          <div className="adopcion-modal" onClick={(event) => event.stopPropagation()}>
            <div className="adopcion-modal-header">
              <div>
                <span>Detalle del perro</span>
                <h2>{mascotaDetalle.nombre || 'Perro sin nombre'}</h2>
              </div>
              <button type="button" onClick={() => setMascotaDetalle(null)} aria-label="Cerrar detalle">
                x
              </button>
            </div>

            <div className="adopcion-modal-body">
              <div className="adopcion-modal-gallery">
                {mascotaDetalle.imagen ? (
                  <img src={mascotaDetalle.imagen} alt={mascotaDetalle.nombre} />
                ) : (
                  <div className="adopcion-modal-placeholder">Sin imagen</div>
                )}
                {mascotaDetalle.imagenes?.length > 1 && (
                  <div className="adopcion-modal-thumbs">
                    {mascotaDetalle.imagenes.slice(1, 4).map((imageUrl, index) => (
                      <img key={`${imageUrl}-${index}`} src={imageUrl} alt={`${mascotaDetalle.nombre} ${index + 2}`} />
                    ))}
                  </div>
                )}
              </div>

              <div className="adopcion-modal-info">
                <InfoItem label="Raza" value={mascotaDetalle.raza || 'No especificada'} />
                <InfoItem label="Sexo" value={mascotaDetalle.sexo || 'No especificado'} />
                <InfoItem label="Edad" value={mascotaDetalle.edad || 'No especificada'} />
                <InfoItem label="Color" value={mascotaDetalle.color || 'No especificado'} />
                <InfoItem label="Ubicacion" value={mascotaDetalle.ubicacion || 'No registrada'} />
                <InfoItem label="Publicado por" value={mascotaDetalle.ownerName || 'No registrado'} />
              </div>

              <div className="adopcion-modal-description">
                <span>Descripcion</span>
                <p>{mascotaDetalle.descripcion || 'Sin descripcion adicional.'}</p>
              </div>

              <div className="adopcion-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMascotaDetalle(null)}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowAdoptionForm((current) => !current)}
                  disabled={mascotaDetalle.ownerId && Number(mascotaDetalle.ownerId) === Number(user?.id)}
                >
                  Solicitar adopcion
                </button>
              </div>

              {showAdoptionForm && (
                <form className="adopcion-inline-form" onSubmit={handleAdoptionRequest}>
                  <div className="form-group">
                    <label htmlFor="adoption-name">Nombre</label>
                    <input
                      id="adoption-name"
                      name="nombreCompleto"
                      value={adoptionForm.nombreCompleto}
                      onChange={handleAdoptionFormChange}
                      disabled={sendingRequest}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="adoption-email">Correo</label>
                    <input
                      id="adoption-email"
                      name="correo"
                      type="email"
                      value={adoptionForm.correo}
                      onChange={handleAdoptionFormChange}
                      disabled={sendingRequest}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="adoption-phone">Telefono</label>
                    <input
                      id="adoption-phone"
                      name="telefono"
                      value={adoptionForm.telefono}
                      onChange={handleAdoptionFormChange}
                      disabled={sendingRequest}
                    />
                  </div>
                  <div className="form-group adopcion-inline-form-full">
                    <label htmlFor="adoption-message">Mensaje</label>
                    <textarea
                      id="adoption-message"
                      name="mensaje"
                      rows="3"
                      value={adoptionForm.mensaje}
                      onChange={handleAdoptionFormChange}
                      placeholder="Cuenta por que quieres adoptar y como cuidarias al perro"
                      disabled={sendingRequest}
                    />
                  </div>
                  <div className="adopcion-inline-form-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAdoptionForm(false)} disabled={sendingRequest}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={sendingRequest}>
                      {sendingRequest ? 'Enviando...' : 'Enviar solicitud'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InfoItem = ({ label, value }) => (
  <div className="adopcion-modal-info-item">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

export default Adopcion;
