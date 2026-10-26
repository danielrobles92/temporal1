import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DOG_BREED_OPTIONS, DOG_COLORS, MEXICO_CITY_LOCATIONS } from '../../constants/dogOptions';
import { createPet, mapFrontendToBackend } from '../../services/petsService';
import { createReport, getReportMatches } from '../../services/platformService';
import CartillaForm, { emptyCartilla } from '../../components/CartillaForm/CartillaForm';
import ImageSlots from '../../components/ImageSlots/ImageSlots';
import DogPhotoAnalysis from '../../components/DogPhotoAnalysis/DogPhotoAnalysis';
import MatchSuggestions from '../../components/MatchSuggestions/MatchSuggestions';
import './PublicarMascota.css';

const initialForm = {
  tipo: 'adopcion',
  nombre: '',
  raza: '',
  otraRaza: '',
  sexo: '',
  color: '',
  otroColor: '',
  edad: '',
  ubicacion: '',
  detalleUbicacion: '',
  latitude: '',
  longitude: '',
  descripcion: '',
  telefono: '',
  imagenes: [],
  cartilla: emptyCartilla(),
};

const PublicarMascota = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState(initialForm);
  const [errores, setErrores] = useState({});
  const [loading, setLoading] = useState(false);
  const [matchModal, setMatchModal] = useState({ open: false, reportId: null, matches: [], loading: false });
  const [photoCheck, setPhotoCheck] = useState({ analyzing: false, blocked: false });

  // Autollenado con lo que detecto la red neuronal (raza y color se reemplazan
  // porque el usuario lo pidio con el boton).
  const applyDetected = ({ raza, color }) => {
    setFormData((current) => ({
      ...current,
      raza: raza || current.raza,
      color: color || current.color,
    }));
    setErrores((prev) => ({ ...prev, raza: '', color: '' }));
    showToast('Datos sugeridos aplicados. Revisalos antes de publicar.', 'success');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextData = { ...formData, [name]: value };

    if (name === 'ubicacion') {
      const selectedLocation = MEXICO_CITY_LOCATIONS.find((location) => location.label === value);
      nextData.latitude = selectedLocation?.lat ?? '';
      nextData.longitude = selectedLocation?.lng ?? '';
    }

    setFormData(nextData);
    if (errores[name]) {
      setErrores({ ...errores, [name]: '' });
    }
  };

  const validateForm = () => {
    const nuevosErrores = {};

    if (!formData.nombre.trim()) nuevosErrores.nombre = 'El nombre es requerido';
    if (!formData.raza) nuevosErrores.raza = 'Selecciona una raza';
    if (formData.raza === 'Otro' && !formData.otraRaza.trim()) nuevosErrores.otraRaza = 'Especifica la raza';
    if (!formData.sexo) nuevosErrores.sexo = 'Selecciona el sexo';
    if (!formData.color) nuevosErrores.color = 'Selecciona un color';
    if (formData.color === 'Otro' && !formData.otroColor.trim()) nuevosErrores.otroColor = 'Especifica el color';
    if (!formData.ubicacion) nuevosErrores.ubicacion = 'Selecciona una ubicacion';
    if (formData.edad && isNaN(parseInt(formData.edad))) nuevosErrores.edad = 'La edad debe ser un numero';
    if (!formData.imagenes.length) nuevosErrores.imagenes = 'Agrega al menos una foto (recomendado 4)';
    if (photoCheck.blocked) nuevosErrores.imagenes = 'Hay fotos que no son de un perro: quitalas para continuar';

    setErrores(nuevosErrores);
    const firstError = Object.values(nuevosErrores)[0];
    if (firstError) showToast(firstError, 'error');
    return Object.keys(nuevosErrores).length === 0;
  };

  const moveMapPoint = (latDelta, lngDelta) => {
    if (formData.latitude === '' || formData.longitude === '') return;
    setFormData({
      ...formData,
      latitude: Number((Number(formData.latitude) + latDelta).toFixed(6)),
      longitude: Number((Number(formData.longitude) + lngDelta).toFixed(6)),
    });
  };

  const buildPetData = () => ({
    ownerId: user?.id,
    nombre: formData.nombre.trim(),
    tipoAnimal: 'Perro',
    raza: formData.raza === 'Otro' ? formData.otraRaza.trim() : formData.raza,
    sexo: formData.sexo,
    color: formData.color === 'Otro' ? formData.otroColor.trim() : formData.color,
    edad: formData.edad ? parseInt(formData.edad) : null,
    edadNumero: formData.edad ? parseInt(formData.edad) : null,
    descripcion: formData.descripcion.trim(),
    ubicacion: formData.detalleUbicacion.trim()
      ? `${formData.ubicacion} - ${formData.detalleUbicacion.trim()}`
      : formData.ubicacion,
    tipo: formData.tipo,
    imagenUrl: formData.imagenes[0]?.preview || '',
    imagenFile: formData.imagenes[0]?.file || null,
    imagenFiles: formData.imagenes.map((image) => image.file).filter(Boolean),
    latitude: formData.latitude === '' ? null : Number(formData.latitude),
    longitude: formData.longitude === '' ? null : Number(formData.longitude),
    cartilla: formData.cartilla,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      if (!user?.isAdmin && user?.role !== 'SHELTER' && !user?.publishingAuthorized && formData.tipo === 'adopcion') {
        const message = 'Necesitas autorizacion vigente para publicar perros en adopcion.';
        showToast(message, 'warning');
        setLoading(false);
        return;
      }

      const petData = buildPetData();
      const backendPet = mapFrontendToBackend(petData);

      if (formData.tipo === 'adopcion') {
        await createPet(backendPet);
        showToast('Anuncio publicado correctamente', 'success');
        navigate('/adopcion');
      } else {
        const created = await createReport({
          reporterId: user?.id,
          type: formData.tipo === 'encontrada' ? 'FOUND' : 'LOST',
          name: petData.nombre,
          species: 'DOG',
          breed: petData.raza,
          sex: backendPet.sex,
          color: petData.color,
          age: petData.edad,
          location: petData.ubicacion,
          latitude: petData.latitude,
          longitude: petData.longitude,
          description: petData.descripcion,
          contactPhone: formData.telefono || user?.phone || '',
          imageUrl: '',
          imageFile: petData.imagenFile,
          status: 'OPEN',
        });
        showToast('Reporte publicado correctamente', 'success');
        // Mostrar posibles coincidencias antes de continuar
        setMatchModal({ open: true, reportId: created?.reportId, matches: [], loading: true });
        const matches = await getReportMatches(created?.reportId).catch(() => []);
        setMatchModal((prev) => ({ ...prev, matches, loading: false }));
      }
    } catch (error) {
      const message = error.message || 'Error al publicar el anuncio. Por favor, intenta de nuevo.';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="publicar-mascota-page">
      <div className="page-header">
        <h1>Publicar Anuncio</h1>
        <p>Registra perros en adopcion, perdidos o encontrados con datos controlados</p>
      </div>

      <div className="form-container">
        <form onSubmit={handleSubmit} className="publicar-form">
          <div className="form-section">
            <h2>Tipo de Anuncio</h2>
            <div className="tipo-anuncio-buttons">
              {[
                ['adopcion', 'Perro en adopcion'],
                ['perdida', 'Perro perdido'],
                ['encontrada', 'Perro encontrado'],
              ].map(([value, label]) => (
                <label className={`tipo-anuncio-button ${formData.tipo === value ? 'active' : ''}`} key={value}>
                  <input type="radio" name="tipo" value={value} checked={formData.tipo === value} onChange={handleChange} disabled={loading} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h2>Informacion del Perro</h2>

            <div className="form-group">
              <label htmlFor="nombre">Nombre *</label>
              <input type="text" id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} className={errores.nombre ? 'error' : ''} placeholder="Nombre del perro" disabled={loading} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="raza">Raza *</label>
                <select id="raza" name="raza" value={formData.raza} onChange={handleChange} className={errores.raza ? 'error' : ''} disabled={loading}>
                  <option value="">Selecciona...</option>
                  {DOG_BREED_OPTIONS.map((breed) => <option key={breed} value={breed}>{breed}</option>)}
                </select>
                {formData.raza === 'Otro' && (
                  <input type="text" name="otraRaza" value={formData.otraRaza} onChange={handleChange} className={errores.otraRaza ? 'error' : ''} placeholder="Especifica la raza" disabled={loading} />
                )}
              </div>

              <div className="form-group">
                <label htmlFor="sexo">Sexo *</label>
                <select id="sexo" name="sexo" value={formData.sexo} onChange={handleChange} className={errores.sexo ? 'error' : ''} disabled={loading}>
                  <option value="">Selecciona...</option>
                  <option value="Macho">Macho</option>
                  <option value="Hembra">Hembra</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="color">Color *</label>
                <select id="color" name="color" value={formData.color} onChange={handleChange} className={errores.color ? 'error' : ''} disabled={loading}>
                  <option value="">Selecciona...</option>
                  {DOG_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
                </select>
                {formData.color === 'Otro' && (
                  <input type="text" name="otroColor" value={formData.otroColor} onChange={handleChange} className={errores.otroColor ? 'error' : ''} placeholder="Especifica el color" disabled={loading} />
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edad">Edad aproximada</label>
                <input type="number" id="edad" name="edad" value={formData.edad} onChange={handleChange} min="0" placeholder="Ej. 2" className={errores.edad ? 'error' : ''} disabled={loading} />
              </div>

              <div className="form-group">
                <label htmlFor="ubicacion">Ubicacion *</label>
                <select id="ubicacion" name="ubicacion" value={formData.ubicacion} onChange={handleChange} className={errores.ubicacion ? 'error' : ''} disabled={loading}>
                  <option value="">Selecciona alcaldia...</option>
                  {MEXICO_CITY_LOCATIONS.map((location) => <option key={location.label} value={location.label}>{location.label}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="detalleUbicacion">Referencia o colonia</label>
              <input
                type="text"
                id="detalleUbicacion"
                name="detalleUbicacion"
                value={formData.detalleUbicacion}
                onChange={handleChange}
                placeholder="Ej. Col. Centro, cerca del parque..."
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="descripcion">Descripcion</label>
              <textarea id="descripcion" name="descripcion" value={formData.descripcion} onChange={handleChange} rows="5" placeholder="Caracteristicas, comportamiento o referencias utiles..." disabled={loading} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="telefono">Telefono de contacto</label>
                <input type="tel" id="telefono" name="telefono" value={formData.telefono || user?.phone || ''} onChange={handleChange} placeholder="55..." disabled={loading} />
              </div>
            </div>

            <div className="form-group">
              <label>Fotos del perro</label>
              <small>Sube de 1 a 4 fotos. Reordénalas y elige la principal (la que se vea mejor). 4 fotos mejoran el reconocimiento.</small>
              <ImageSlots
                value={formData.imagenes}
                onChange={(imagenes) => {
                  setFormData((current) => ({ ...current, imagenes }));
                  if (errores.imagenes) setErrores((prev) => ({ ...prev, imagenes: '' }));
                }}
                disabled={loading}
                onError={(msg) => showToast(msg, 'error')}
              />
              <DogPhotoAnalysis
                images={formData.imagenes}
                onApply={applyDetected}
                onStatusChange={setPhotoCheck}
                disabled={loading}
              />
              {errores.imagenes && <span className="error-message">{errores.imagenes}</span>}
            </div>

            {formData.latitude && formData.longitude && (
              <div className="map-preview editable-map-preview">
                <iframe
                  title="Ubicacion seleccionada"
                  src={`https://maps.google.com/maps?q=${formData.latitude},${formData.longitude}&z=14&output=embed`}
                  loading="lazy"
                />
                <div className="map-controls">
                  <button type="button" onClick={() => moveMapPoint(0.003, 0)} disabled={loading}>Norte</button>
                  <button type="button" onClick={() => moveMapPoint(0, -0.003)} disabled={loading}>Oeste</button>
                  <button type="button" onClick={() => moveMapPoint(0, 0.003)} disabled={loading}>Este</button>
                  <button type="button" onClick={() => moveMapPoint(-0.003, 0)} disabled={loading}>Sur</button>
                </div>
              </div>
            )}
          </div>

          {formData.tipo === 'adopcion' && (
            <div className="form-section">
              <h2>Cartilla / Salud</h2>
              <small>Datos opcionales del historial de salud y vacunas del perro.</small>
              <CartillaForm
                value={formData.cartilla}
                onChange={(cartilla) => setFormData((current) => ({ ...current, cartilla }))}
                disabled={loading}
              />
            </div>
          )}

          <div className="form-actions">
            <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary" disabled={loading}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Publicando...' : 'Publicar Anuncio'}</button>
          </div>
        </form>
      </div>

      {matchModal.open && (
        <div className="modal-overlay" onClick={() => navigate('/mascotas-perdidas')}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Posibles coincidencias</h2>
            </div>
            <div className="modal-body">
              {matchModal.loading ? (
                <p>Buscando coincidencias con la base de datos...</p>
              ) : (
                <>
                  <p>Revisa si tu perro está entre estas posibles coincidencias antes de continuar:</p>
                  <MatchSuggestions matches={matchModal.matches} />
                </>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/mascotas-perdidas')}>
                Continuar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!matchModal.reportId}
                onClick={() => navigate(`/reporte/${matchModal.reportId}`)}
              >
                Ver mi reporte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicarMascota;
