import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DOG_BREEDS, DOG_BREED_OPTIONS, DOG_COLORS, MEXICO_CITY_LOCATIONS } from '../../constants/dogOptions';
import { useToast } from '../../context/ToastContext';
import { getPetDetails, mapBackendToFrontend, mapFrontendToBackendUpdate, updatePet } from '../../services/petsService';
import CartillaForm, { emptyCartilla } from '../../components/CartillaForm/CartillaForm';
import ImageSlots from '../../components/ImageSlots/ImageSlots';
import DogPhotoAnalysis from '../../components/DogPhotoAnalysis/DogPhotoAnalysis';
import './EditarMascota.css';

const EditarMascota = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    nombre: '',
    raza: '',
    otraRaza: '',
    color: '',
    otroColor: '',
    edad: '',
    descripcion: '',
    ubicacion: '',
    detalleUbicacion: '',
    latitude: '',
    longitude: '',
    estado: 'adopcion',
    cartilla: emptyCartilla(),
    imagenes: [],
    imagenesActuales: [],
  });

  const [errores, setErrores] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [errorGeneral, setErrorGeneral] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [photoCheck, setPhotoCheck] = useState({ analyzing: false, blocked: false });

  useEffect(() => {
    const loadPetData = async () => {
      try {
        setLoadingData(true);
        const petData = await getPetDetails(id);
        const mappedPet = mapBackendToFrontend(petData);
        const knownBreed = DOG_BREEDS.includes(mappedPet.raza) ? mappedPet.raza : 'Otro';
        const knownColor = DOG_COLORS.includes(mappedPet.color) ? mappedPet.color : 'Otro';

        setFormData({
          nombre: mappedPet.nombre || '',
          raza: knownBreed,
          otraRaza: knownBreed === 'Otro' ? mappedPet.raza || '' : '',
          color: knownColor,
          otroColor: knownColor === 'Otro' ? mappedPet.color || '' : '',
          edad: mappedPet.edadNumero || '',
          descripcion: mappedPet.descripcion || '',
          ubicacion: (mappedPet.ubicacion || '').split(' - ')[0],
          detalleUbicacion: (mappedPet.ubicacion || '').split(' - ').slice(1).join(' - '),
          latitude: mappedPet.latitude ?? '',
          longitude: mappedPet.longitude ?? '',
          estado: mappedPet.estado || 'adopcion',
          cartilla: mappedPet.cartilla || emptyCartilla(),
          imagenes: [],
          imagenesActuales: mappedPet.imagenes || [],
        });
      } catch (err) {
        const message = err.message || 'Error al cargar los datos de la mascota';
        setErrorGeneral(message);
        showToast(message, 'error');
      } finally {
        setLoadingData(false);
      }
    };

    if (id) loadPetData();
  }, [id, showToast]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextData = { ...formData, [name]: value };

    if (name === 'ubicacion') {
      const selectedLocation = MEXICO_CITY_LOCATIONS.find((location) => location.label === value);
      nextData.latitude = selectedLocation?.lat ?? '';
      nextData.longitude = selectedLocation?.lng ?? '';
    }

    setFormData(nextData);
    if (errores[name]) setErrores({ ...errores, [name]: '' });
    if (errorGeneral) setErrorGeneral('');
    if (successMessage) setSuccessMessage('');
  };

  const validateForm = () => {
    const nuevosErrores = {};
    if (!formData.nombre.trim()) nuevosErrores.nombre = 'El nombre es requerido';
    if (photoCheck.blocked) nuevosErrores.imagenes = 'Hay fotos que no son de un perro: quitalas para continuar';
    if (!formData.raza) nuevosErrores.raza = 'Selecciona una raza';
    if (formData.raza === 'Otro' && !formData.otraRaza.trim()) nuevosErrores.otraRaza = 'Especifica la raza';
    if (!formData.color) nuevosErrores.color = 'Selecciona un color';
    if (formData.color === 'Otro' && !formData.otroColor.trim()) nuevosErrores.otroColor = 'Especifica el color';
    if (!formData.ubicacion) nuevosErrores.ubicacion = 'Selecciona una ubicacion';
    if (formData.edad && isNaN(parseInt(formData.edad))) nuevosErrores.edad = 'La edad debe ser un numero';

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorGeneral('');
    setSuccessMessage('');
    if (!validateForm()) return;

    setLoading(true);
    try {
      const petData = {
        nombre: formData.nombre.trim(),
        raza: formData.raza === 'Otro' ? formData.otraRaza.trim() : formData.raza,
        color: formData.color === 'Otro' ? formData.otroColor.trim() : formData.color,
        edad: formData.edad ? parseInt(formData.edad) : null,
        edadNumero: formData.edad ? parseInt(formData.edad) : null,
        descripcion: formData.descripcion.trim(),
        ubicacion: formData.detalleUbicacion.trim()
          ? `${formData.ubicacion} - ${formData.detalleUbicacion.trim()}`
          : formData.ubicacion,
        latitude: formData.latitude === '' ? null : Number(formData.latitude),
        longitude: formData.longitude === '' ? null : Number(formData.longitude),
        estado: formData.estado,
        cartilla: formData.cartilla,
        imageFiles: formData.imagenes.map((img) => img.file).filter(Boolean),
      };

      await updatePet(id, mapFrontendToBackendUpdate(petData));
      setSuccessMessage('Mascota actualizada exitosamente');
      showToast('Mascota actualizada exitosamente', 'success');
      setTimeout(() => navigate(`/mascota/${id}`), 1200);
    } catch (error) {
      const message = error.message || 'Error al actualizar la mascota';
      setErrorGeneral(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="editar-mascota-page">
        <div className="loading-container">
          <div className="loading-spinner">Cargando datos de la mascota...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="editar-mascota-page">
      <div className="page-header">
        <h1>Editar Perro</h1>
        <p>Actualiza la informacion con opciones controladas</p>
      </div>

      <div className="form-container">
        <form onSubmit={handleSubmit} className="editar-form">
          {errorGeneral && <div className="error-alert">{errorGeneral}</div>}
          {successMessage && <div className="success-alert">{successMessage}</div>}

          <div className="form-section">
            <h2>Informacion del Perro</h2>

            <div className="form-group">
              <label htmlFor="nombre">Nombre *</label>
              <input type="text" id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} className={errores.nombre ? 'error' : ''} disabled={loading} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="raza">Raza *</label>
                <select id="raza" name="raza" value={formData.raza} onChange={handleChange} className={errores.raza ? 'error' : ''} disabled={loading}>
                  <option value="">Selecciona...</option>
                  {DOG_BREED_OPTIONS.map((breed) => <option key={breed} value={breed}>{breed}</option>)}
                </select>
                {formData.raza === 'Otro' && <input type="text" name="otraRaza" value={formData.otraRaza} onChange={handleChange} className={errores.otraRaza ? 'error' : ''} placeholder="Especifica la raza" disabled={loading} />}
              </div>

              <div className="form-group">
                <label htmlFor="color">Color *</label>
                <select id="color" name="color" value={formData.color} onChange={handleChange} className={errores.color ? 'error' : ''} disabled={loading}>
                  <option value="">Selecciona...</option>
                  {DOG_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
                </select>
                {formData.color === 'Otro' && <input type="text" name="otroColor" value={formData.otroColor} onChange={handleChange} className={errores.otroColor ? 'error' : ''} placeholder="Especifica el color" disabled={loading} />}
              </div>

              <div className="form-group">
                <label htmlFor="edad">Edad aproximada</label>
                <input type="number" id="edad" name="edad" value={formData.edad} onChange={handleChange} min="0" className={errores.edad ? 'error' : ''} disabled={loading} />
              </div>
            </div>

            <div className="form-row">
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

            <div className="form-group">
              <label htmlFor="descripcion">Descripcion</label>
              <textarea id="descripcion" name="descripcion" value={formData.descripcion} onChange={handleChange} rows="5" disabled={loading} />
            </div>

            <div className="form-group">
              <label htmlFor="estado">Estado *</label>
              <select id="estado" name="estado" value={formData.estado} onChange={handleChange} disabled={loading} className="select-estado">
                <option value="adopcion">En adopcion</option>
                <option value="adoptada">Adoptada</option>
                <option value="perdida">Perdida</option>
              </select>
            </div>
          </div>

          <div className="form-section">
            <h2>Fotos</h2>
            {formData.imagenesActuales.length > 0 && (
              <div className="fotos-actuales">
                <small>Fotos actuales:</small>
                <div className="fotos-actuales-grid">
                  {formData.imagenesActuales.map((url, i) => (
                    <img key={`${url}-${i}`} src={url} alt={`Foto actual ${i + 1}`} />
                  ))}
                </div>
              </div>
            )}
            <small>Subir fotos nuevas <strong>reemplaza</strong> las actuales. Reordénalas y elige la principal.</small>
            <ImageSlots
              value={formData.imagenes}
              onChange={(imagenes) => setFormData((current) => ({ ...current, imagenes }))}
              disabled={loading}
              onError={(msg) => showToast(msg, 'error')}
            />
            <DogPhotoAnalysis images={formData.imagenes} onStatusChange={setPhotoCheck} disabled={loading} />
            {errores.imagenes && <span className="error-message">{errores.imagenes}</span>}
          </div>

          <div className="form-section">
            <h2>Cartilla / Salud</h2>
            <small>Historial de salud y vacunas del perro.</small>
            <CartillaForm
              value={formData.cartilla}
              onChange={(cartilla) => setFormData((current) => ({ ...current, cartilla }))}
              disabled={loading}
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={() => navigate(`/mascota/${id}`)} className="btn btn-secondary" disabled={loading}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Guardar Cambios'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditarMascota;
