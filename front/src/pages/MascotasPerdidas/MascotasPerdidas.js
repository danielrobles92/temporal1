import React, { useEffect, useState } from 'react';
import MascotaCard from '../../components/MascotaCard/MascotaCard';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getPetsLost, mapBackendToFrontend } from '../../services/petsService';
import { createReportSighting, getReports } from '../../services/platformService';
import './MascotasPerdidas.css';

const SIZE_FETCH_ALL = 9999;
const VISIBLE_CARDS = 3;

const FILTROS_INICIALES = {
  busqueda: '',
  ubicacion: '',
  tipoReporte: '',
  estadoReporte: '',
};

const SIGHTING_FORM_INITIAL = {
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  location: '',
  message: '',
  imageFiles: [],
  imagePreviews: [],
};

const MascotasPerdidas = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [mascotas, setMascotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [detalle, setDetalle] = useState(null);
  const [showSightingForm, setShowSightingForm] = useState(false);
  const [sightingForm, setSightingForm] = useState(SIGHTING_FORM_INITIAL);
  const [sendingSighting, setSendingSighting] = useState(false);
  const [filtrosDraft, setFiltrosDraft] = useState(FILTROS_INICIALES);
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);

  const loadPets = async () => {
    try {
      setLoading(true);
      setError('');
      const [response, lostReports] = await Promise.all([
        getPetsLost(SIZE_FETCH_ALL),
        getReports(),
      ]);
      const content = Array.isArray(response) ? response : (response.content || []);
      const lostPetCards = content.map((pet) => {
        const mappedPet = mapBackendToFrontend(pet);
        return {
          ...mappedPet,
          estado: 'perdida',
          tipoReporte: 'LOST',
          estadoReporte: 'OPEN',
        };
      });
      const reportCards = (lostReports || []).map((report) => ({
        id: `reporte-${report.reportId}`,
        nombre: report.name,
        tipo: 'Perro',
        raza: report.breed || '',
        sexo: report.sex === 'MALE' ? 'Macho' : report.sex === 'FEMALE' ? 'Hembra' : '',
        color: report.color || '',
        edad: report.age ? `${report.age} ${report.age === 1 ? 'año' : 'años'}` : '',
        edadNumero: report.age,
        descripcion: report.description || '',
        ubicacion: report.location || '',
        estado: 'perdida',
        tipoReporte: report.type,
        estadoReporte: report.status,
        imagen: report.imageUrl || '',
        imagenes: report.imageUrl ? [report.imageUrl] : [],
        ownerName: report.reporterName || '',
        reporterEmail: report.reporterEmail || '',
        contactPhone: report.contactPhone || '',
      }));
      setMascotas([...lostPetCards, ...reportCards]);
    } catch (err) {
      setError(err.message || 'Error al cargar las mascotas perdidas');
      console.error('Error al cargar mascotas perdidas:', err);
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
    const estadoReporte = String(mascota.estadoReporte || '').toUpperCase();
    const tipoReporte = String(mascota.tipoReporte || '').toUpperCase();
    const coincideEstado = !filtros.estadoReporte || estadoReporte === filtros.estadoReporte;
    const coincideTipo = !filtros.tipoReporte || tipoReporte === filtros.tipoReporte;

    return coincideUbicacion && coincideBusqueda && coincideEstado && coincideTipo;
  });

  const maxCarouselIndex = Math.max(0, mascotasFiltradas.length - VISIBLE_CARDS);

  useEffect(() => {
    if (carouselIndex > maxCarouselIndex) {
      setCarouselIndex(maxCarouselIndex);
    }
  }, [carouselIndex, maxCarouselIndex]);

  useEffect(() => {
    if (!detalle) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDetalle(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [detalle]);

  useEffect(() => {
    if (!detalle) {
      setShowSightingForm(false);
      setSightingForm(SIGHTING_FORM_INITIAL);
      return;
    }

    setSightingForm({
      ...SIGHTING_FORM_INITIAL,
      contactName: user?.name || user?.username || '',
      contactEmail: user?.email || '',
      contactPhone: user?.phone || '',
    });
  }, [detalle, user]);

  const handleFiltroChange = (event) => {
    const { name, value } = event.target;
    setFiltrosDraft((prev) => ({ ...prev, [name]: value }));
  };

  const aplicarFiltros = (event) => {
    event.preventDefault();
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

  const handleSightingFormChange = (event) => {
    const { name, value } = event.target;
    setSightingForm((current) => ({ ...current, [name]: value }));
  };

  const handleSightingImagesChange = (event) => {
    const files = Array.from(event.target.files || []).slice(0, 4);

    if (files.some((file) => file.size > 3 * 1024 * 1024)) {
      showToast('Cada imagen no debe superar 3MB', 'error');
      event.target.value = '';
      return;
    }

    const readers = files.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    }));

    Promise.all(readers).then((previews) => {
      setSightingForm((current) => ({
        ...current,
        imageFiles: files,
        imagePreviews: previews,
      }));
    });
  };

  const reportIdFromDetalle = () => {
    const id = String(detalle?.id || '');
    return id.startsWith('reporte-') ? Number(id.replace('reporte-', '')) : null;
  };

  const handleSightingSubmit = async (event) => {
    event.preventDefault();
    const reportId = reportIdFromDetalle();

    if (!reportId) {
      showToast('Este registro no tiene un reporte asociado para contactar', 'warning');
      return;
    }

    if (!sightingForm.contactName.trim() || !sightingForm.message.trim()) {
      showToast('Agrega tu nombre y la informacion del posible perro', 'warning');
      return;
    }

    setSendingSighting(true);
    try {
      await createReportSighting(reportId, {
        userId: user?.id || null,
        contactName: sightingForm.contactName.trim(),
        contactEmail: sightingForm.contactEmail.trim(),
        contactPhone: sightingForm.contactPhone.trim(),
        location: sightingForm.location.trim(),
        message: sightingForm.message.trim(),
        imageFiles: sightingForm.imageFiles,
      });
      showToast('Aviso enviado al reporte', 'success');
      setShowSightingForm(false);
      setDetalle(null);
    } catch (err) {
      showToast(err.message || 'No se pudo enviar el aviso', 'error');
    } finally {
      setSendingSighting(false);
    }
  };

  return (
    <div className="perdidas-page">
      <div className="perdidas-layout">
        <aside className="perdidas-filtros-card">
          <h2 className="perdidas-filtros-title">Filtros de busqueda</h2>
          <form className="perdidas-filtros-form" onSubmit={aplicarFiltros}>
            <div className="form-group">
              <label htmlFor="busqueda-perdidas">Buscar por nombre o raza</label>
              <input
                id="busqueda-perdidas"
                type="text"
                name="busqueda"
                className="perdidas-input"
                placeholder="Ej. Max, mestizo"
                value={filtrosDraft.busqueda}
                onChange={handleFiltroChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="ubicacion-perdidas">Ubicacion</label>
              <input
                id="ubicacion-perdidas"
                type="text"
                name="ubicacion"
                className="perdidas-input"
                placeholder="Ej. Iztapalapa"
                value={filtrosDraft.ubicacion}
                onChange={handleFiltroChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="tipo-reporte">Tipo</label>
              <select id="tipo-reporte" name="tipoReporte" className="perdidas-input" value={filtrosDraft.tipoReporte} onChange={handleFiltroChange}>
                <option value="">Todos</option>
                <option value="LOST">Perdidos</option>
                <option value="FOUND">Encontrados</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="estado-reporte">Estado</label>
              <select id="estado-reporte" name="estadoReporte" className="perdidas-input" value={filtrosDraft.estadoReporte} onChange={handleFiltroChange}>
                <option value="">Todos</option>
                <option value="OPEN">Abierto</option>
                <option value="RESOLVED">Resuelto</option>
              </select>
            </div>

            <div className="perdidas-filtros-actions">
              <button type="submit" className="btn btn-primary btn-block">Aplicar filtros</button>
              <button type="button" className="btn btn-secondary btn-block" onClick={limpiarFiltros}>Limpiar</button>
            </div>
          </form>
        </aside>

        <section className="perdidas-resultados">
          <div className="perdidas-resultados-header">
            <button type="button" className="perdidas-carousel-side-button" onClick={() => moverCarrusel(-1)} disabled={carouselIndex === 0}>
              Anterior
            </button>
            <h1>Perros perdidos y encontrados</h1>
            <button type="button" className="perdidas-carousel-side-button" onClick={() => moverCarrusel(1)} disabled={carouselIndex >= maxCarouselIndex}>
              Siguiente
            </button>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner">Cargando reportes...</div>
            </div>
          ) : error ? (
            <div className="error-alert"><span>{error}</span></div>
          ) : mascotasFiltradas.length > 0 ? (
            <div className="perdidas-carousel">
              <div
                className="perdidas-carousel-track"
                style={{ transform: `translateX(calc(-${carouselIndex} * ((100% - 40px) / 3 + 20px)))` }}
              >
                {mascotasFiltradas.map((mascota) => (
                  <div className="perdidas-carousel-slide" key={mascota.id}>
                    <MascotaCard mascota={mascota} variant="perdidas" onDetalle={setDetalle} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="perdidas-mascotas-grid">
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

      {detalle && (
        <div className="perdidas-modal-overlay" onClick={() => setDetalle(null)}>
          <div className="perdidas-modal" onClick={(event) => event.stopPropagation()}>
            <div className="perdidas-modal-header">
              <div>
                <span>Detalle del perro</span>
                <h2>{detalle.nombre || 'Perro sin nombre'}</h2>
              </div>
              <button type="button" onClick={() => setDetalle(null)} aria-label="Cerrar detalle">
                x
              </button>
            </div>
            <div className="perdidas-modal-body">
              <div className="perdidas-modal-gallery">
                {detalle.imagen ? (
                  <img src={detalle.imagen} alt={detalle.nombre} />
                ) : (
                  <div className="perdidas-modal-placeholder">Sin imagen</div>
                )}
                {detalle.imagenes?.length > 1 && (
                  <div className="perdidas-modal-thumbs">
                    {detalle.imagenes.slice(1, 4).map((imageUrl, index) => (
                      <img
                        key={`${imageUrl}-${index}`}
                        src={imageUrl}
                        alt={`${detalle.nombre} ${index + 2}`}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="perdidas-modal-info">
                {detalle.tipoReporte && (
                  <InfoItem
                    label="Tipo"
                    value={detalle.tipoReporte === 'FOUND' ? 'Encontrado' : 'Perdido'}
                  />
                )}
                {detalle.estadoReporte && (
                  <InfoItem
                    label="Estado del reporte"
                    value={detalle.estadoReporte === 'RESOLVED' ? 'Resuelto' : 'Abierto'}
                  />
                )}
                <InfoItem label="Raza" value={detalle.raza || 'No especificada'} />
                <InfoItem label="Sexo" value={detalle.sexo || 'No especificado'} />
                <InfoItem label="Edad" value={detalle.edad || 'No especificada'} />
                <InfoItem label="Color" value={detalle.color || 'No especificado'} />
                <InfoItem label="Ubicacion" value={detalle.ubicacion || 'No registrada'} />
                <InfoItem label="Publicado por" value={detalle.ownerName || 'No registrado'} />
              </div>
              <div className="perdidas-modal-description">
                <span>Descripcion</span>
                <p>{detalle.descripcion || 'Sin descripcion adicional.'}</p>
              </div>

              <div className="perdidas-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDetalle(null)}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowSightingForm((current) => !current)}
                >
                  Contactar
                </button>
              </div>

              {showSightingForm && (
                <form className="perdidas-contact-form" onSubmit={handleSightingSubmit}>
                  <div className="perdidas-contact-intro">
                    <strong>{detalle.tipoReporte === 'FOUND' ? '¿Crees que es tu perro?' : '¿Viste un perro parecido?'}</strong>
                    <span>{detalle.tipoReporte === 'FOUND' ? 'Envia datos y fotos para avisar a quien lo encontro.' : 'Envia ubicacion, datos y fotos para avisar a quien lo busca.'}</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="sighting-name">Tu nombre</label>
                    <input
                      id="sighting-name"
                      name="contactName"
                      value={sightingForm.contactName}
                      onChange={handleSightingFormChange}
                      disabled={sendingSighting}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="sighting-email">Correo</label>
                    <input
                      id="sighting-email"
                      name="contactEmail"
                      type="email"
                      value={sightingForm.contactEmail}
                      onChange={handleSightingFormChange}
                      disabled={sendingSighting}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="sighting-phone">Telefono</label>
                    <input
                      id="sighting-phone"
                      name="contactPhone"
                      value={sightingForm.contactPhone}
                      onChange={handleSightingFormChange}
                      disabled={sendingSighting}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="sighting-location">Donde lo viste</label>
                    <input
                      id="sighting-location"
                      name="location"
                      value={sightingForm.location}
                      onChange={handleSightingFormChange}
                      placeholder="Colonia, calle o referencia"
                      disabled={sendingSighting}
                    />
                  </div>
                  <div className="form-group perdidas-contact-full">
                    <label htmlFor="sighting-message">Informacion</label>
                    <textarea
                      id="sighting-message"
                      name="message"
                      rows="3"
                      value={sightingForm.message}
                      onChange={handleSightingFormChange}
                      placeholder="Describe donde lo viste, hora aproximada, comportamiento o señas"
                      disabled={sendingSighting}
                      required
                    />
                  </div>
                  <div className="form-group perdidas-contact-full">
                    <label>Fotos del posible perro</label>
                    <label className="perdidas-sighting-picker">
                      <input type="file" accept="image/*" multiple onChange={handleSightingImagesChange} disabled={sendingSighting} />
                      <span>Seleccionar fotos</span>
                      <strong>{sightingForm.imageFiles.length}/4 fotos</strong>
                    </label>
                    {sightingForm.imagePreviews.length > 0 && (
                      <div className="perdidas-sighting-previews">
                        {sightingForm.imagePreviews.map((preview, index) => (
                          <img key={`${preview}-${index}`} src={preview} alt={`Aviso ${index + 1}`} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="perdidas-contact-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowSightingForm(false)} disabled={sendingSighting}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={sendingSighting || !reportIdFromDetalle()}>
                      {sendingSighting ? 'Enviando...' : 'Enviar aviso'}
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
  <div className="perdidas-modal-info-item">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

export default MascotasPerdidas;
