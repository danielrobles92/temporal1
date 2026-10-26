import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DOG_BREEDS, DOG_COLORS, MEXICO_CITY_LOCATIONS } from '../../constants/dogOptions';
import {
  getAllPets,
  deletePet,
  mapBackendToFrontend,
  mapFrontendToBackendUpdate,
  updatePet,
} from '../../services/petsService';
import {
  deactivatePet,
  createSightingCase,
  deleteReport,
  getAllReportSightings,
  getReports,
  getPetsByOwner,
  getReportSightingsByOwner,
  getReportsByUser,
  moderateReport,
  replyReportSighting,
  updateReport,
  updateReportSightingCase,
} from '../../services/platformService';
import './MisAnuncios.css';

const reportTypeLabel = {
  LOST: 'Perdido',
  FOUND: 'Encontrado',
};

const MisAnuncios = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [pets, setPets] = useState([]);
  const [reports, setReports] = useState([]);
  const [sightings, setSightings] = useState([]);
  const [activeTab, setActiveTab] = useState('todos');
  const [selectedSighting, setSelectedSighting] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [editingReport, setEditingReport] = useState(null);
  const [reportEditForm, setReportEditForm] = useState(null);
  const [selectedPet, setSelectedPet] = useState(null);
  const [selectedPetImage, setSelectedPetImage] = useState('');
  const [petToDelete, setPetToDelete] = useState(null);
  const [editingPet, setEditingPet] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isAdmin = user?.isAdmin || user?.role === 'ADMIN';
  const canEditPet = (pet) => isAdmin || Number(pet?.ownerId) === Number(user?.id);
  // Quien puede publicar en adopcion: admin, refugio o usuario con autorizacion vigente.
  const canPublish = isAdmin || user?.role === 'SHELTER' || user?.publishingAuthorized;

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const tab = query.get('tab');
    setActiveTab(['anuncios', 'reportes', 'avisos'].includes(tab) ? tab : 'todos');
  }, [location.search]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      if (isAdmin) {
        const [petsData, reportsData, sightingData] = await Promise.all([
          getAllPets(9999),
          getReports(),
          getAllReportSightings().catch(() => []),
        ]);
        const petContent = Array.isArray(petsData) ? petsData : (petsData.content || []);
        setPets(petContent.map(mapBackendToFrontend));
        setReports(reportsData || []);
        setSightings(sightingData || []);
        return;
      }

      const [petsData, reportsData] = await Promise.all([
        getPetsByOwner(user.id),
        getReportsByUser(user.id),
      ]);
      setPets((petsData || []).map(mapBackendToFrontend));
      setReports(reportsData || []);
      const sightingData = await getReportSightingsByOwner(user.id).catch(() => []);
      setSightings(sightingData || []);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar tus anuncios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id, isAdmin]);

  const removePet = async () => {
    if (!petToDelete) return;
    setActionLoading(true);
    try {
      await deletePet(petToDelete.id);
      showToast('Publicacion eliminada', 'success');
      setPetToDelete(null);
      setSelectedPet(null);
      await load();
    } catch (err) {
      showToast(err.message || 'No se pudo eliminar la publicacion', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const disablePet = async (petId) => {
    await deactivatePet(petId);
    await load();
  };

  const openSighting = (sighting) => {
    setSelectedSighting(sighting);
    setReplyText(sighting.ownerReply || '');
  };

  const openReportEditor = (report) => {
    setEditingReport(report);
    setReportEditForm({
      name: report.name || '',
      breed: report.breed || '',
      sex: report.sex || '',
      color: report.color || '',
      age: report.age || '',
      location: report.location || '',
      description: report.description || '',
      contactPhone: report.contactPhone || user?.phone || '',
      imageFile: null,
      imagePreview: report.imageUrl || '',
    });
  };

  const handleReportImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Selecciona una imagen valida', 'warning');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('La foto debe pesar menos de 5 MB', 'warning');
      event.target.value = '';
      return;
    }
    setReportEditForm({
      ...reportEditForm,
      imageFile: file,
      imagePreview: URL.createObjectURL(file),
    });
  };

  const saveReportEdit = async () => {
    if (!editingReport || !reportEditForm) return;
    setActionLoading(true);
    try {
      await updateReport(editingReport.reportId, {
        ...editingReport,
        ...reportEditForm,
        species: 'DOG',
        sex: reportEditForm.sex || null,
        age: reportEditForm.age === '' ? null : Number(reportEditForm.age),
        type: editingReport.type || 'LOST',
        status: editingReport.status || 'OPEN',
        imageUrl: editingReport.imageUrl || '',
      });
      showToast('Reporte actualizado', 'success');
      setEditingReport(null);
      setReportEditForm(null);
      await load();
    } catch (err) {
      showToast(err.message || 'No se pudo actualizar el reporte', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const disableReport = async (reportId) => {
    setActionLoading(true);
    try {
      await moderateReport(reportId, 'INACTIVE', 'Reporte desactivado por el publicador.');
      showToast('Reporte desactivado', 'success');
      await load();
    } catch (err) {
      showToast(err.message || 'No se pudo desactivar el reporte', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const removeReport = async () => {
    if (!reportToDelete) return;
    setActionLoading(true);
    try {
      await deleteReport(reportToDelete.reportId);
      showToast('Reporte eliminado', 'success');
      setReportToDelete(null);
      setSelectedReport(null);
      await load();
    } catch (err) {
      showToast(err.message || 'No se pudo eliminar el reporte', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openPetEditor = (pet) => {
    const ageValue = pet.edadNumero ?? pet.age ?? (String(pet.edad || '').match(/\d+/)?.[0] || '');
    const locationMatch = MEXICO_CITY_LOCATIONS.find((location) =>
      String(pet.ubicacion || '').toLowerCase().startsWith(location.label.toLowerCase())
    );

    setEditingPet(pet);
    setEditForm({
      nombre: pet.nombre || '',
      raza: pet.raza || '',
      color: pet.color || '',
      age: ageValue,
      descripcion: pet.descripcion || '',
      ubicacion: locationMatch?.label || pet.ubicacion || '',
      latitude: pet.latitude ?? locationMatch?.lat ?? null,
      longitude: pet.longitude ?? locationMatch?.lng ?? null,
      estadoBackend: pet.estadoBackend || 'AVAILABLE',
      imageFiles: [],
      imagePreviews: pet.imagenes?.length ? pet.imagenes : (pet.imagen ? [pet.imagen] : []),
      activeImagePreview: pet.imagenes?.[0] || pet.imagen || '',
    });
  };

  const openPetDetail = (pet) => {
    setSelectedPet(pet);
    setSelectedPetImage(pet.imagenes?.[0] || pet.imagen || '');
  };

  const updatePetLocation = (value) => {
    const selectedLocation = MEXICO_CITY_LOCATIONS.find((location) => location.label === value);
    setEditForm({
      ...editForm,
      ubicacion: value,
      latitude: selectedLocation?.lat ?? null,
      longitude: selectedLocation?.lng ?? null,
    });
  };

  const handleEditImagesChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));

    if (selectedFiles.length > 4) {
      showToast('Selecciona maximo 4 fotos', 'warning');
    }

    const files = selectedFiles.slice(0, 4);
    const oversized = files.find((file) => file.size > 5 * 1024 * 1024);

    if (oversized) {
      showToast('Cada foto debe pesar menos de 5 MB', 'warning');
      event.target.value = '';
      return;
    }

    const previews = files.map((file) => URL.createObjectURL(file));

    setEditForm({
      ...editForm,
      imageFiles: files,
      imagePreviews: previews,
      activeImagePreview: previews[0] || editForm.activeImagePreview,
    });
  };

  const savePetEdit = async () => {
    if (!editingPet || !editForm) return;
    setActionLoading(true);
    try {
      await updatePet(editingPet.id, mapFrontendToBackendUpdate({
        ...editingPet,
        ...editForm,
        estadoBackend: editForm.estadoBackend,
      }));
      showToast('Publicacion actualizada', 'success');
      setEditingPet(null);
      setEditForm(null);
      await load();
    } catch (err) {
      showToast(err.message || 'No se pudo actualizar la publicacion', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const replySighting = async (status = 'REPLIED') => {
    if (!selectedSighting || !replyText.trim()) {
      showToast('Escribe una respuesta para quien envio el aviso', 'warning');
      return;
    }

    setActionLoading(true);
    try {
      const updated = await replyReportSighting(selectedSighting.sightingId, replyText.trim(), status);
      showToast(status === 'CASE_OPENED' ? 'Caso abierto y respuesta enviada' : 'Respuesta enviada', 'success');
      setSelectedSighting(updated);
      await load();
    } catch (err) {
      showToast(err.message || 'No se pudo responder el aviso', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const updateCase = async (status) => {
    if (!selectedSighting) return;
    setActionLoading(true);
    try {
      const updated = status === 'CASE_OPENED'
        ? await createSightingCase(selectedSighting.sightingId)
        : await updateReportSightingCase(selectedSighting.sightingId, status, replyText.trim());
      showToast(status === 'CASE_OPENED' ? 'Caso abierto' : 'Aviso descartado', 'success');
      if (status === 'DISMISSED') {
        setSelectedSighting(null);
        setReplyText('');
      } else if (status === 'CASE_OPENED') {
        setSelectedSighting(null);
        setReplyText('');
        navigate(`/casos?case=${updated.caseId}`);
      } else {
        setSelectedSighting(updated);
      }
      await load();
    } catch (err) {
      showToast(err.message || 'No se pudo actualizar el caso', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const showSection = (section) => activeTab === 'todos' || activeTab === section;

  return (
    <div className="mis-anuncios-page">
      <div className="page-header">
        <h1>Mis anuncios</h1>
        <p>{isAdmin ? 'Vista admin: gestiona todas las publicaciones, reportes y avisos' : 'Gestiona publicaciones de adopcion y reportes registrados'}</p>
      </div>

      <div className="mis-anuncios-tabs" aria-label="Filtros de anuncios">
        {[
          ['todos', 'Todos'],
          ['anuncios', 'Publicaciones de adopcion'],
          ['reportes', 'Reportes de extravio'],
          ['avisos', `Avisos recibidos${sightings.length ? ` (${sightings.length})` : ''}`],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={activeTab === value ? 'active' : ''}
            onClick={() => {
              setActiveTab(value);
              navigate(value === 'todos' ? '/mis-anuncios' : `/mis-anuncios?tab=${value}`, { replace: true });
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-container">Cargando anuncios...</div>
      ) : error ? (
        <div className="error-alert">{error}</div>
      ) : (
        <>
          {showSection('anuncios') && <section className="anuncios-section">
            <div className="section-title-row">
              <h2>Publicaciones de adopcion</h2>
              {canPublish ? (
                <button className="btn btn-primary" onClick={() => navigate('/publicar')}>Publicar</button>
              ) : (
                <button
                  className="btn btn-secondary"
                  onClick={() => navigate('/perfil')}
                  title="Necesitas autorizacion del administrador para publicar en adopcion"
                >
                  Solicitar autorizacion para publicar
                </button>
              )}
            </div>
            <div className="anuncios-list">
              {pets.length === 0 ? (
                <p className="empty-state">No tienes publicaciones de adopcion.</p>
              ) : (
                pets.map((pet) => (
                  <article key={pet.id} className="anuncio-card" onClick={() => openPetDetail(pet)}>
                    {pet.imagen && (
                      <img className="anuncio-image" src={pet.imagen} alt={pet.nombre || 'Perro'} />
                    )}
                    <div className="anuncio-card-content">
                      <strong>{pet.nombre}</strong>
                      <span>{pet.estadoBackend}</span>
                      <p>{pet.raza || pet.tipo} - {pet.ubicacion}</p>
                    </div>
                    <div className="actions-row" onClick={(event) => event.stopPropagation()}>
                      {canEditPet(pet) && (
                        <>
                          <button className="btn btn-secondary" onClick={() => openPetEditor(pet)}>Editar</button>
                          <button className="btn btn-secondary" onClick={() => disablePet(pet.id)}>Desactivar</button>
                          <button className="btn btn-danger" onClick={() => setPetToDelete(pet)}>Eliminar</button>
                        </>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>}

          {showSection('reportes') && <section className="anuncios-section">
            <h2>Reportes de extravio</h2>
            <div className="anuncios-list">
              {reports.length === 0 ? (
                <p className="empty-state">No tienes reportes registrados.</p>
              ) : (
                reports.map((report) => (
                  <article key={report.reportId} className="anuncio-card" onClick={() => setSelectedReport(report)}>
                    {report.imageUrl && (
                      <img className="anuncio-image" src={report.imageUrl} alt={report.name || 'Reporte'} />
                    )}
                    <div className="anuncio-card-content">
                      <strong>{report.name}</strong>
                      <span>{reportTypeLabel[report.type] || report.type} - {report.status}</span>
                      <p>{report.location}</p>
                    </div>
                    {report.moderationNotes && <small>{report.moderationNotes}</small>}
                    <div className="actions-row" onClick={(event) => event.stopPropagation()}>
                      <button type="button" className="btn btn-secondary" onClick={() => openReportEditor(report)}>
                        Editar
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => disableReport(report.reportId)} disabled={actionLoading}>
                        Desactivar
                      </button>
                      <button type="button" className="btn btn-danger" onClick={() => setReportToDelete(report)}>
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>}

          {showSection('avisos') && <section className="anuncios-section">
            <h2>Avisos recibidos</h2>
            <div className="anuncios-list">
              {sightings.length === 0 ? (
                <p className="empty-state">Aun no tienes avisos sobre tus perros perdidos.</p>
              ) : (
                sightings.map((sighting) => (
                  <article key={sighting.sightingId} className="anuncio-card sighting-card" onClick={() => openSighting(sighting)}>
                    {sighting.imageUrls?.[0] && (
                      <img className="anuncio-image" src={sighting.imageUrls[0]} alt={sighting.reportName || 'Aviso'} />
                    )}
                    <div className="anuncio-card-content">
                      <strong>{sighting.reportName || 'Perro perdido'}</strong>
                      <span>{sighting.status === 'CASE_OPENED' ? 'Caso abierto' : sighting.status === 'DISMISSED' ? 'Descartado' : sighting.status === 'REPLIED' ? 'Respondido' : 'Nuevo aviso'}</span>
                      <p>{sighting.location || 'Sin ubicacion'} - {sighting.contactName}</p>
                    </div>
                    <div className="actions-row">
                      <button type="button" className="btn btn-primary" onClick={(event) => { event.stopPropagation(); openSighting(sighting); }}>
                        Ver aviso
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>}
        </>
      )}

      {selectedSighting && (
        <div className="mis-anuncios-modal-overlay" onClick={() => setSelectedSighting(null)}>
          <div className="mis-anuncios-modal" onClick={(event) => event.stopPropagation()}>
            <div className="mis-anuncios-modal-header">
              <div>
                <span>Aviso recibido</span>
                <h2>{selectedSighting.reportName || 'Perro perdido'}</h2>
              </div>
              <button type="button" onClick={() => setSelectedSighting(null)}>x</button>
            </div>

            <div className="mis-anuncios-modal-body">
              {selectedSighting.imageUrls?.length > 0 && (
                <div className="sighting-images">
                  {selectedSighting.imageUrls.map((url, index) => (
                    <img key={`${url}-${index}`} src={url} alt={`Aviso ${index + 1}`} />
                  ))}
                </div>
              )}

              <div className="sighting-detail-grid">
                <div><span>Estado</span><strong>{selectedSighting.status || 'NEW'}</strong></div>
                <div><span>Contacto</span><strong>{selectedSighting.contactName || 'No registrado'}</strong></div>
                <div><span>Correo</span><strong>{selectedSighting.contactEmail || 'No registrado'}</strong></div>
                <div><span>Telefono</span><strong>{selectedSighting.contactPhone || 'No registrado'}</strong></div>
                <div><span>Ubicacion</span><strong>{selectedSighting.location || 'No registrada'}</strong></div>
              </div>

              <div className="sighting-message">
                <span>Mensaje recibido</span>
                <p>{selectedSighting.message || 'Sin mensaje.'}</p>
              </div>

              {selectedSighting.status === 'CASE_OPENED' && (
                <div className="sighting-case-board">
                  <span>Caso abierto</span>
                  <p>Este espacio reune la informacion para conectar a quien vio al perro con quien lo busca.</p>
                  <div><strong>Perro:</strong> {selectedSighting.reportName || 'Perro perdido'}</div>
                  <div><strong>Quien aviso:</strong> {selectedSighting.contactName || 'No registrado'} - {selectedSighting.contactEmail || 'Sin correo'}</div>
                  <div><strong>Ubicacion del aviso:</strong> {selectedSighting.location || 'No registrada'}</div>
                  {selectedSighting.ownerReply && (
                    <div><strong>Respuesta enviada:</strong> {selectedSighting.ownerReply}</div>
                  )}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="owner-reply">Respuesta para quien aviso</label>
                <textarea
                  id="owner-reply"
                  rows="4"
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Escribe si crees que puede ser tu perro y como deseas continuar el contacto"
                  disabled={actionLoading}
                />
              </div>
            </div>

            <div className="mis-anuncios-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedSighting(null)} disabled={actionLoading}>Cerrar</button>
              <button type="button" className="btn btn-secondary" onClick={() => updateCase('DISMISSED')} disabled={actionLoading}>No es mi perro</button>
              <button type="button" className="btn btn-primary" onClick={() => replySighting('REPLIED')} disabled={actionLoading}>Responder</button>
              <button type="button" className="btn btn-success" onClick={() => updateCase('CASE_OPENED')} disabled={actionLoading}>Abrir caso</button>
            </div>
          </div>
        </div>
      )}

      {selectedReport && (
        <div className="mis-anuncios-modal-overlay" onClick={() => setSelectedReport(null)}>
          <div className="mis-anuncios-modal" onClick={(event) => event.stopPropagation()}>
            <div className="mis-anuncios-modal-header">
              <div>
                <span>Detalle del reporte</span>
                <h2>{selectedReport.name || 'Perro perdido'}</h2>
              </div>
              <button type="button" onClick={() => setSelectedReport(null)}>x</button>
            </div>
            <div className="mis-anuncios-modal-body report-detail-modal">
              {selectedReport.imageUrl && <img className="report-detail-image" src={selectedReport.imageUrl} alt={selectedReport.name || 'Reporte'} />}
              <div className="sighting-detail-grid">
                <div><span>Estado</span><strong>{selectedReport.status || 'Abierto'}</strong></div>
                <div><span>Tipo</span><strong>{reportTypeLabel[selectedReport.type] || selectedReport.type || 'Perdido'}</strong></div>
                <div><span>Raza</span><strong>{selectedReport.breed || 'No registrada'}</strong></div>
                <div><span>Sexo</span><strong>{selectedReport.sex || 'No registrado'}</strong></div>
                <div><span>Edad</span><strong>{selectedReport.age ? `${selectedReport.age} años` : 'No registrada'}</strong></div>
                <div><span>Color</span><strong>{selectedReport.color || 'No registrado'}</strong></div>
                <div><span>Ubicacion</span><strong>{selectedReport.location || 'No registrada'}</strong></div>
                <div><span>Contacto</span><strong>{selectedReport.contactPhone || user?.phone || 'No registrado'}</strong></div>
              </div>
              <div className="sighting-message">
                <span>Descripcion</span>
                <p>{selectedReport.description || 'Sin descripcion adicional.'}</p>
              </div>
            </div>
            <div className="mis-anuncios-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedReport(null)}>Cerrar</button>
              <button type="button" className="btn btn-primary" onClick={() => { setSelectedReport(null); openReportEditor(selectedReport); }}>Editar</button>
              <button type="button" className="btn btn-danger" onClick={() => setReportToDelete(selectedReport)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {reportToDelete && (
        <div className="mis-anuncios-modal-overlay" onClick={() => !actionLoading && setReportToDelete(null)}>
          <div className="mis-anuncios-modal delete-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="mis-anuncios-modal-header">
              <div>
                <span>Confirmar eliminacion</span>
                <h2>{reportToDelete.name || 'Reporte de extravio'}</h2>
              </div>
              <button type="button" onClick={() => setReportToDelete(null)} disabled={actionLoading}>x</button>
            </div>
            <div className="mis-anuncios-modal-body">
              <div className="sighting-message">
                <span>Eliminar reporte</span>
                <p>Esta accion eliminara definitivamente el reporte de extravio.</p>
              </div>
              <div className="sighting-detail-grid">
                <div><span>Perro</span><strong>{reportToDelete.name || 'Sin nombre'}</strong></div>
                <div><span>Ubicacion</span><strong>{reportToDelete.location || 'No registrada'}</strong></div>
              </div>
            </div>
            <div className="mis-anuncios-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setReportToDelete(null)} disabled={actionLoading}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={removeReport} disabled={actionLoading}>
                {actionLoading ? 'Eliminando...' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingReport && reportEditForm && (
        <div className="mis-anuncios-modal-overlay" onClick={() => setEditingReport(null)}>
          <div className="mis-anuncios-modal" onClick={(event) => event.stopPropagation()}>
            <div className="mis-anuncios-modal-header">
              <div>
                <span>Editar reporte</span>
                <h2>{editingReport.name || 'Perro perdido'}</h2>
              </div>
              <button type="button" onClick={() => setEditingReport(null)}>x</button>
            </div>
            <div className="mis-anuncios-modal-body edit-pet-modal">
              <div className="form-group">
                <label>Nombre</label>
                <input value={reportEditForm.name} onChange={(event) => setReportEditForm({ ...reportEditForm, name: event.target.value })} />
              </div>
              <div className="form-grid-two">
                <div className="form-group">
                  <label>Raza</label>
                  <input value={reportEditForm.breed} onChange={(event) => setReportEditForm({ ...reportEditForm, breed: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Sexo</label>
                  <select value={reportEditForm.sex} onChange={(event) => setReportEditForm({ ...reportEditForm, sex: event.target.value })}>
                    <option value="">Selecciona</option>
                    <option value="MALE">Macho</option>
                    <option value="FEMALE">Hembra</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Color</label>
                  <input value={reportEditForm.color} onChange={(event) => setReportEditForm({ ...reportEditForm, color: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Edad</label>
                  <input type="number" min="0" value={reportEditForm.age} onChange={(event) => setReportEditForm({ ...reportEditForm, age: event.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Ubicacion</label>
                <input value={reportEditForm.location} onChange={(event) => setReportEditForm({ ...reportEditForm, location: event.target.value })} />
              </div>
              <div className="form-group">
                <label>Telefono de contacto</label>
                <input value={reportEditForm.contactPhone} onChange={(event) => setReportEditForm({ ...reportEditForm, contactPhone: event.target.value })} />
              </div>
              <div className="form-group">
                <label>Descripcion</label>
                <textarea rows="4" value={reportEditForm.description} onChange={(event) => setReportEditForm({ ...reportEditForm, description: event.target.value })} />
              </div>
              <div className="form-group edit-images-field">
                <label>Foto del reporte</label>
                <input type="file" accept="image/*" onChange={handleReportImageChange} disabled={actionLoading} />
                <small>Si no eliges una nueva foto, se conserva la actual.</small>
                {reportEditForm.imagePreview && (
                  <div className="edit-image-preview-grid single-preview">
                    <img src={reportEditForm.imagePreview} alt="Foto del reporte" />
                  </div>
                )}
              </div>
            </div>
            <div className="mis-anuncios-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEditingReport(null)} disabled={actionLoading}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={saveReportEdit} disabled={actionLoading}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}

      {selectedPet && (
        <div className="mis-anuncios-modal-overlay" onClick={() => setSelectedPet(null)}>
          <div className="mis-anuncios-modal pet-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="mis-anuncios-modal-header">
              <div>
                <span>Detalle del perro</span>
                <h2>{selectedPet.nombre || 'Perro en adopcion'}</h2>
              </div>
              <button type="button" onClick={() => setSelectedPet(null)}>x</button>
            </div>
            <div className="mis-anuncios-modal-body pet-detail-body">
              {(selectedPetImage || selectedPet.imagen) && (
                <div className="pet-detail-gallery">
                  <img className="pet-detail-main-image" src={selectedPetImage || selectedPet.imagen} alt={selectedPet.nombre || 'Perro'} />
                  {selectedPet.imagenes?.length > 1 && (
                    <div className="pet-detail-thumbs">
                      {selectedPet.imagenes.slice(0, 4).map((url, index) => (
                        <button
                          type="button"
                          key={`${url}-${index}`}
                          className={`pet-thumb-button ${(selectedPetImage || selectedPet.imagen) === url ? 'active' : ''}`}
                          onClick={() => setSelectedPetImage(url)}
                          aria-label={`Ver foto ${index + 1}`}
                        >
                          <img src={url} alt={`Foto ${index + 1}`} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="pet-detail-info-grid">
                <div><span>Raza</span><strong>{selectedPet.raza || 'No registrada'}</strong></div>
                <div><span>Sexo</span><strong>{selectedPet.sexo || 'No registrado'}</strong></div>
                <div><span>Edad</span><strong>{selectedPet.age ? `${selectedPet.age} años` : 'No registrada'}</strong></div>
                <div><span>Color</span><strong>{selectedPet.color || 'No registrado'}</strong></div>
                <div><span>Ubicacion</span><strong>{selectedPet.ubicacion || 'No registrada'}</strong></div>
                <div><span>Estado</span><strong>{selectedPet.estadoBackend || 'Disponible'}</strong></div>
              </div>
              <div className="sighting-message">
                <span>Descripcion</span>
                <p>{selectedPet.descripcion || 'Sin descripcion adicional.'}</p>
              </div>
            </div>
            <div className="mis-anuncios-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedPet(null)}>Cerrar</button>
              {canEditPet(selectedPet) && (
                <>
                  <button type="button" className="btn btn-primary" onClick={() => { setSelectedPet(null); openPetEditor(selectedPet); }}>Editar</button>
                  <button type="button" className="btn btn-danger" onClick={() => setPetToDelete(selectedPet)}>Eliminar</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {petToDelete && (
        <div className="mis-anuncios-modal-overlay" onClick={() => !actionLoading && setPetToDelete(null)}>
          <div className="mis-anuncios-modal delete-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="mis-anuncios-modal-header">
              <div>
                <span>Confirmar eliminacion</span>
                <h2>{petToDelete.nombre || 'Publicacion'}</h2>
              </div>
              <button type="button" onClick={() => setPetToDelete(null)} disabled={actionLoading}>x</button>
            </div>
            <div className="mis-anuncios-modal-body">
              <div className="sighting-message">
                <span>Eliminar publicacion</span>
                <p>Esta accion eliminara definitivamente la publicacion de adopcion.</p>
              </div>
              <div className="sighting-detail-grid">
                <div><span>Perro</span><strong>{petToDelete.nombre || 'Sin nombre'}</strong></div>
                <div><span>Ubicacion</span><strong>{petToDelete.ubicacion || 'No registrada'}</strong></div>
              </div>
            </div>
            <div className="mis-anuncios-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setPetToDelete(null)} disabled={actionLoading}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={removePet} disabled={actionLoading}>
                {actionLoading ? 'Eliminando...' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPet && editForm && (
        <div className="mis-anuncios-modal-overlay" onClick={() => setEditingPet(null)}>
          <div className="mis-anuncios-modal" onClick={(event) => event.stopPropagation()}>
            <div className="mis-anuncios-modal-header">
              <div>
                <span>Editar publicacion</span>
                <h2>{editingPet.nombre || 'Perro en adopcion'}</h2>
              </div>
              <button type="button" onClick={() => setEditingPet(null)}>x</button>
            </div>
            <div className="mis-anuncios-modal-body edit-pet-modal">
              <div className="form-group">
                <label>Nombre</label>
                <input value={editForm.nombre} onChange={(event) => setEditForm({ ...editForm, nombre: event.target.value })} />
              </div>
              <div className="form-grid-two">
                <div className="form-group">
                  <label>Raza</label>
                  <select value={editForm.raza} onChange={(event) => setEditForm({ ...editForm, raza: event.target.value })}>
                    <option value="">Selecciona raza</option>
                    {!DOG_BREEDS.includes(editForm.raza) && editForm.raza && <option value={editForm.raza}>{editForm.raza}</option>}
                    {DOG_BREEDS.map((breed) => <option key={breed} value={breed}>{breed}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Color</label>
                  <select value={editForm.color} onChange={(event) => setEditForm({ ...editForm, color: event.target.value })}>
                    <option value="">Selecciona color</option>
                    {!DOG_COLORS.includes(editForm.color) && editForm.color && <option value={editForm.color}>{editForm.color}</option>}
                    {DOG_COLORS.map((color) => <option key={color} value={color}>{color}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Edad</label>
                  <input type="number" min="0" value={editForm.age} onChange={(event) => setEditForm({ ...editForm, age: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <select value={editForm.estadoBackend} onChange={(event) => setEditForm({ ...editForm, estadoBackend: event.target.value })}>
                    <option value="AVAILABLE">Disponible</option>
                    <option value="ADOPTED">Adoptado</option>
                    <option value="INACTIVE">Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Ubicacion</label>
                <select value={editForm.ubicacion} onChange={(event) => updatePetLocation(event.target.value)}>
                  <option value="">Selecciona ubicacion</option>
                  {!MEXICO_CITY_LOCATIONS.some((location) => location.label === editForm.ubicacion) && editForm.ubicacion && (
                    <option value={editForm.ubicacion}>{editForm.ubicacion}</option>
                  )}
                  {MEXICO_CITY_LOCATIONS.map((location) => (
                    <option key={location.label} value={location.label}>{location.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Descripcion</label>
                <textarea rows="4" value={editForm.descripcion} onChange={(event) => setEditForm({ ...editForm, descripcion: event.target.value })} />
              </div>
              <div className="form-group edit-images-field">
                <label>Fotos de la publicacion</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleEditImagesChange}
                  disabled={actionLoading}
                />
                <small>Selecciona hasta 4 fotos en una sola vez. Si no eliges nuevas, se conservan las actuales.</small>
                {editForm.imagePreviews?.length > 0 && (
                  <div className="edit-image-picker">
                    <img className="edit-main-preview" src={editForm.activeImagePreview || editForm.imagePreviews[0]} alt="Vista previa seleccionada" />
                    <div className="edit-image-preview-grid">
                      {editForm.imagePreviews.slice(0, 4).map((url, index) => (
                        <button
                          type="button"
                          key={`${url}-${index}`}
                          className={`pet-thumb-button ${(editForm.activeImagePreview || editForm.imagePreviews[0]) === url ? 'active' : ''}`}
                          onClick={() => setEditForm({ ...editForm, activeImagePreview: url })}
                          aria-label={`Ver foto ${index + 1}`}
                        >
                          <img src={url} alt={`Foto ${index + 1}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mis-anuncios-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEditingPet(null)} disabled={actionLoading}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={savePetEdit} disabled={actionLoading}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MisAnuncios;
