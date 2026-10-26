import React, { useEffect, useMemo, useState } from 'react';
import {
  deleteAdoptionRequestAdmin,
  deleteAuthorizationRequest,
  deleteCaseAdmin,
  deleteReport,
  deleteUser,
  decideAuthorizationRequest,
  getAllAdoptionRequests,
  getAllAuthorizationRequests,
  getAllCases,
  getReports,
  getUsers,
  moderateReport,
  reanalyzeStoredImages,
  updateAccountStatus,
  updatePublishingAuthorization,
  updateUserRole,
} from '../../services/platformService';
import { deletePet, getAllPets } from '../../services/petsService';
import DogPhotoTester from '../../components/DogPhotoTester/DogPhotoTester';
import { useToast } from '../../context/ToastContext';
import './AdminPanel.css';

const roleLabel = {
  USER: 'Usuario',
  SHELTER: 'Refugio',
  ADMIN: 'Admin',
};

const authStatusLabel = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
};

const requestStatusLabel = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

const reportTypeLabel = {
  LOST: 'Perdido',
  FOUND: 'Encontrado',
};

const reportStatusLabel = {
  OPEN: 'Abierto',
  RESOLVED: 'Cerrado',
};

const petStatusLabel = {
  AVAILABLE: 'En adopcion',
  ADOPTED: 'Adoptado',
  LOST: 'Perdido',
};

const caseStatusLabel = {
  OPEN: 'Abierto',
  ADOPTED: 'Adoptado',
  CANCELLED: 'Cancelado',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
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

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [authorizations, setAuthorizations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [pets, setPets] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [userFilter, setUserFilter] = useState('ALL');
  const [reportFilter, setReportFilter] = useState('ALL');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedAuthorization, setSelectedAuthorization] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalysisResult, setReanalysisResult] = useState(null);
  const { showToast } = useToast();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersData, authData, requestData, reportData, petData, caseData] = await Promise.all([
        getUsers(),
        getAllAuthorizationRequests(),
        getAllAdoptionRequests(),
        getReports(),
        getAllPets(9999),
        getAllCases(),
      ]);
      setUsers(usersData || []);
      setAuthorizations((authData || []).filter((item) => {
        const role = usersData?.find((user) => Number(user.id) === Number(item.userId))?.role;
        return role !== 'ADMIN';
      }));
      setRequests(requestData || []);
      setReports(reportData || []);
      setPets(Array.isArray(petData) ? petData : (petData?.content || []));
      setCases(caseData || []);
    } catch (err) {
      const message = err.message || 'No se pudo cargar el panel de administracion';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const usersById = useMemo(() => {
    const map = new Map();
    users.forEach((user) => map.set(Number(user.id), user));
    return map;
  }, [users]);

  const userStats = useMemo(() => ({
    total: users.length,
    users: users.filter((user) => user.role === 'USER').length,
    shelters: users.filter((user) => user.role === 'SHELTER').length,
    admins: users.filter((user) => user.role === 'ADMIN').length,
  }), [users]);

  const reportStats = useMemo(() => {
    const openCases = cases.filter((item) => !['ADOPTED', 'CANCELLED', 'RESOLVED', 'CLOSED'].includes(item.status)).length;
    return {
      petsTotal: pets.length,
      petsAvailable: pets.filter((pet) => pet.status === 'AVAILABLE').length,
      petsAdopted: pets.filter((pet) => pet.status === 'ADOPTED').length,
      reportsLost: reports.filter((report) => report.type === 'LOST').length,
      reportsFound: reports.filter((report) => report.type === 'FOUND').length,
      reportsOpen: reports.filter((report) => report.status === 'OPEN').length,
      requestsPending: requests.filter((request) => request.status === 'PENDING').length,
      casesOpen: openCases,
    };
  }, [pets, reports, requests, cases]);

  const filteredPets = useMemo(() => {
    if (reportFilter === 'PETS_TOTAL') return pets;
    if (reportFilter === 'PETS_AVAILABLE') return pets.filter((pet) => pet.status === 'AVAILABLE');
    if (reportFilter === 'PETS_ADOPTED') return pets.filter((pet) => pet.status === 'ADOPTED');
    return pets;
  }, [pets, reportFilter]);

  const filteredReportsForTable = useMemo(() => {
    if (reportFilter === 'REPORTS_LOST') return reports.filter((report) => report.type === 'LOST');
    if (reportFilter === 'REPORTS_FOUND') return reports.filter((report) => report.type === 'FOUND');
    if (reportFilter === 'REPORTS_OPEN') return reports.filter((report) => report.status === 'OPEN');
    return reports;
  }, [reports, reportFilter]);

  const filteredRequestsForTable = useMemo(() => (
    reportFilter === 'REQUESTS_PENDING' ? requests.filter((request) => request.status === 'PENDING') : requests
  ), [requests, reportFilter]);

  const filteredCasesForTable = useMemo(() => {
    if (reportFilter !== 'CASES_OPEN') return cases;
    return cases.filter((item) => !['ADOPTED', 'CANCELLED', 'RESOLVED', 'CLOSED'].includes(item.status));
  }, [cases, reportFilter]);

  const petRows = useMemo(() => filteredPets.slice(0, 8), [filteredPets]);
  const reportRows = useMemo(() => filteredReportsForTable.slice(0, 8), [filteredReportsForTable]);
  const caseRows = useMemo(() => filteredCasesForTable.slice(0, 8), [filteredCasesForTable]);

  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();
    const byRole = userFilter === 'ALL' ? users : users.filter((user) => user.role === userFilter);
    if (!query) return byRole;
    return byRole.filter((user) => (
      String(user.username || '').toLowerCase().includes(query)
      || String(user.email || '').toLowerCase().includes(query)
    ));
  }, [users, userQuery, userFilter]);

  const profileData = useMemo(() => {
    if (!selectedUser) return null;
    const id = Number(selectedUser.id);
    return {
      authorizations: authorizations.filter((item) => Number(item.userId) === id),
      adoptionRequests: requests.filter((item) => Number(item.userId) === id),
      receivedRequests: requests.filter((item) => {
        const ownerName = String(item.petOwnerName || '').toLowerCase();
        return ownerName && ownerName === String(selectedUser.username || '').toLowerCase();
      }),
      reports: reports.filter((item) => Number(item.reporterId) === id),
    };
  }, [selectedUser, authorizations, requests, reports]);

  const changeRole = async (userId, role) => {
    await updateUserRole(userId, role);
    await load();
  };

  const changeSelectedUserRole = async (role) => {
    if (!selectedUser?.id) return;
    try {
      await changeRole(selectedUser.id, role);
      setSelectedUser((current) => (current ? { ...current, role } : current));
      showToast('Rol actualizado correctamente', 'success');
    } catch (err) {
      showToast(err.message || 'No se pudo actualizar el rol', 'error');
    }
  };

  const toggleAccount = async (userId, active) => {
    await updateAccountStatus(userId, active);
    await load();
  };

  const togglePublishing = async (userId, authorized) => {
    await updatePublishingAuthorization(userId, authorized);
    await load();
  };

  const decideAuth = async (authorizationId, status) => {
    try {
      await decideAuthorizationRequest(authorizationId, status);
      showToast(status === 'APPROVED' ? 'Autorizacion aprobada' : 'Autorizacion rechazada', 'success');
      setSelectedAuthorization(null);
      await load();
    } catch (err) {
      showToast(err.message || 'No se pudo actualizar la autorizacion', 'error');
    }
  };

  const moderate = async (reportId, status) => {
    const notes = status === 'OPEN' ? 'Caso reabierto por administracion.' : 'Reporte marcado como resuelto.';
    setActionLoading(`report-${reportId}-${status}`);
    setError('');
    try {
      await moderateReport(reportId, status, notes);
      showToast('Reporte actualizado correctamente', 'success');
      setSelectedReport(null);
      await load();
    } catch (err) {
      const message = err.message || 'No se pudo actualizar el reporte';
      setError(message);
      showToast(message, 'error');
    } finally {
      setActionLoading('');
    }
  };

  const removeReport = async (reportId) => {
    setActionLoading(`report-${reportId}-delete`);
    setError('');
    try {
      await deleteReport(reportId);
      showToast('Reporte eliminado correctamente', 'success');
      setSelectedReport(null);
      setReportToDelete(null);
      await load();
    } catch (err) {
      const message = err.message || 'No se pudo eliminar el reporte';
      setError(message);
      showToast(message, 'error');
    } finally {
      setActionLoading('');
    }
  };

  const requestDelete = (title, description, onDelete) => {
    setDeleteTarget({ title, description, onDelete });
  };

  const confirmDeleteTarget = async () => {
    if (!deleteTarget) return;
    setActionLoading('delete-target');
    try {
      await deleteTarget.onDelete();
      showToast('Elemento eliminado correctamente', 'success');
      setDeleteTarget(null);
      setSelectedUser(null);
      setSelectedAuthorization(null);
      setSelectedRequest(null);
      setSelectedReport(null);
      await load();
    } catch (err) {
      showToast(err.message || 'No se pudo eliminar el elemento', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const reanalyzeImages = async () => {
    setReanalyzing(true);
    setReanalysisResult(null);
    try {
      const result = await reanalyzeStoredImages();
      setReanalysisResult(result);
      if (result.pets + result.reports === 0) {
        showToast('No se analizo ninguna foto. Verifica que el servicio de IA (ml-service) este encendido.', 'error');
      } else {
        showToast('Fotos re-analizadas correctamente', 'success');
      }
    } catch (err) {
      showToast(err.message || 'No se pudieron re-analizar las fotos', 'error');
    } finally {
      setReanalyzing(false);
    }
  };

  const openUserFromAuth = (authorization) => {
    const user = usersById.get(Number(authorization.userId));
    if (user) setSelectedUser(user);
  };

  return (
    <div className="admin-panel-page">
      <div className="page-header">
        <h1>Administracion</h1>
        <p>Gestiona usuarios, autorizaciones, solicitudes y reportes</p>
      </div>

      {loading ? (
        <div className="loading-container">Cargando panel...</div>
      ) : error ? (
        <div className="error-alert">{error}</div>
      ) : (
        <>
          <section className="admin-section">
            <div className="admin-section-header">
              <h2>Reporte general</h2>
              <span className="admin-report-date">Actualizado {formatDateTime(new Date())}</span>
            </div>

            <div className="admin-metrics report-metrics">
              <Metric value={reportStats.petsTotal} label="perros registrados" active={reportFilter === 'PETS_TOTAL'} onClick={() => setReportFilter('PETS_TOTAL')} />
              <Metric value={reportStats.petsAvailable} label="en adopcion" active={reportFilter === 'PETS_AVAILABLE'} onClick={() => setReportFilter('PETS_AVAILABLE')} />
              <Metric value={reportStats.reportsLost} label="perdidos" active={reportFilter === 'REPORTS_LOST'} onClick={() => setReportFilter('REPORTS_LOST')} />
              <Metric value={reportStats.reportsFound} label="encontrados" active={reportFilter === 'REPORTS_FOUND'} onClick={() => setReportFilter('REPORTS_FOUND')} />
              <Metric value={reportStats.requestsPending} label="solicitudes pendientes" active={reportFilter === 'REQUESTS_PENDING'} onClick={() => setReportFilter('REQUESTS_PENDING')} />
              <Metric value={reportStats.casesOpen} label="casos abiertos" active={reportFilter === 'CASES_OPEN'} onClick={() => setReportFilter('CASES_OPEN')} />
              <Metric value={reportStats.reportsOpen} label="reportes abiertos" active={reportFilter === 'REPORTS_OPEN'} onClick={() => setReportFilter('REPORTS_OPEN')} />
              <Metric value={reportStats.petsAdopted} label="adoptados" active={reportFilter === 'PETS_ADOPTED'} onClick={() => setReportFilter('PETS_ADOPTED')} />
            </div>

            <div className="admin-report-grid">
              <ReportChart
                title="Perros por estado"
                items={[
                  ['En adopcion', reportStats.petsAvailable],
                  ['Adoptados', reportStats.petsAdopted],
                  ['Perdidos', pets.filter((pet) => pet.status === 'LOST').length],
                ]}
              />
              <ReportChart
                title="Reportes"
                items={[
                  ['Perdidos', reportStats.reportsLost],
                  ['Encontrados', reportStats.reportsFound],
                  ['Abiertos', reportStats.reportsOpen],
                  ['Cerrados', reports.filter((report) => report.status === 'RESOLVED').length],
                ]}
              />
              <ReportChart
                title="Casos"
                items={[
                  ['Adopcion', cases.filter((item) => item.caseType === 'ADOPTION').length],
                  ['Perdidos', cases.filter((item) => item.caseType === 'LOST').length],
                  ['Abiertos', reportStats.casesOpen],
                  ['Cerrados', cases.filter((item) => ['ADOPTED', 'CANCELLED', 'RESOLVED', 'CLOSED'].includes(item.status)).length],
                ]}
              />
            </div>
          </section>

          <section className="admin-section">
            <div className="admin-section-header">
              <h2>Usuarios</h2>
              <input
                className="admin-search"
                value={userQuery}
                onChange={(event) => setUserQuery(event.target.value)}
                placeholder="Buscar por nombre o correo"
              />
            </div>

            <div className="admin-metrics">
              <Metric value={userStats.total} label="usuarios actuales" active={userFilter === 'ALL'} onClick={() => setUserFilter('ALL')} />
              <Metric value={userStats.users} label="usuarios normales" active={userFilter === 'USER'} onClick={() => setUserFilter('USER')} />
              <Metric value={userStats.shelters} label="refugios" active={userFilter === 'SHELTER'} onClick={() => setUserFilter('SHELTER')} />
              <Metric value={userStats.admins} label="admins" active={userFilter === 'ADMIN'} onClick={() => setUserFilter('ADMIN')} />
            </div>

            <div className="admin-table">
              {filteredUsers.map((user) => (
                <article key={user.id} className="admin-row user-admin-row" onClick={() => setSelectedUser(user)}>
                  <div>
                    <strong>{user.username}</strong>
                    <span>{user.email}</span>
                    <small>{roleLabel[user.role] || user.role}</small>
                  </div>
                  <div className="admin-actions user-row-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-secondary" onClick={() => togglePublishing(user.id, !user.publishingAuthorized)}>
                      {user.publishingAuthorized ? 'Quitar permiso' : 'Autorizar publicar'}
                    </button>
                    <button className="btn btn-danger" onClick={() => toggleAccount(user.id, !user.accountActive)}>
                      {user.accountActive ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => requestDelete(user.username, 'Se eliminara este usuario definitivamente.', () => deleteUser(user.id))}
                    >
                      Borrar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-section">
            <h2>Tablas de decision</h2>
            <div className="admin-report-tables">
              <MiniTable
                title="Perros recientes"
                headers={['Perro', 'Estado', 'Ubicacion']}
                rows={petRows.map((pet) => [
                  pet.name || 'Sin nombre',
                  petStatusLabel[pet.status] || pet.status,
                  pet.location || 'Sin ubicacion',
                ])}
              />
              <MiniTable
                title="Reportes recientes"
                headers={['Reporte', 'Tipo', 'Estado']}
                rows={reportRows.map((report) => [
                  report.name || 'Sin nombre',
                  reportTypeLabel[report.type] || report.type,
                  reportStatusLabel[report.status] || report.status,
                ])}
              />
              <MiniTable
                title="Casos recientes"
                headers={['Caso', 'Tipo', 'Estado']}
                rows={caseRows.map((item) => [
                  item.title || 'Caso',
                  item.caseType === 'ADOPTION' ? 'Adopcion' : 'Perdido',
                  caseStatusLabel[item.status] || item.status,
                ])}
              />
            </div>
          </section>

          <section className="admin-section">
            <h2>Perros registrados {reportFilter.startsWith('PETS') ? `(${filteredPets.length})` : ''}</h2>
            <div className="admin-table">
              {filteredPets.length === 0 ? <p className="empty-state">No hay perros registrados.</p> : filteredPets.map((pet) => (
                <article key={pet.petId || pet.id} className="admin-row pet-admin-row">
                  <div>
                    <strong>{pet.name || 'Sin nombre'}</strong>
                    <span>{petStatusLabel[pet.status] || pet.status} - {pet.location || 'Sin ubicacion'}</span>
                    <small>{pet.breed || 'Sin raza'} - {pet.color || 'Sin color'}</small>
                  </div>
                  <button
                    className="btn btn-danger"
                    onClick={() => requestDelete(pet.name || 'Perro', 'Se eliminara esta publicacion de perro definitivamente.', () => deletePet(pet.petId || pet.id))}
                  >
                    Borrar
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-section">
            <h2>Casos {reportFilter === 'CASES_OPEN' ? `(${filteredCasesForTable.length})` : ''}</h2>
            <div className="admin-table">
              {filteredCasesForTable.length === 0 ? <p className="empty-state">No hay casos registrados.</p> : filteredCasesForTable.map((item) => (
                <article key={item.caseId} className="admin-row case-admin-row">
                  <div>
                    <strong>{item.title || 'Caso'}</strong>
                    <span>{item.caseType === 'ADOPTION' ? 'Adopcion' : 'Perdido'} - {caseStatusLabel[item.status] || item.status}</span>
                    <small>{formatDateTime(item.updatedAt)}</small>
                  </div>
                  <button
                    className="btn btn-danger"
                    onClick={() => requestDelete(item.title || 'Caso', 'Se eliminara este caso y sus mensajes.', () => deleteCaseAdmin(item.caseId))}
                  >
                    Borrar caso
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-section">
            <h2>Autorizaciones para publicar</h2>
            <div className="admin-table">
              {authorizations.length === 0 ? <p className="empty-state">No hay solicitudes de autorizacion.</p> : authorizations.map((item) => (
                <article key={item.authorizationId} className="admin-row authorization-admin-row" onClick={() => setSelectedAuthorization(item)}>
                  <div>
                    <strong>{item.username || usersById.get(Number(item.userId))?.username || 'Usuario sin nombre'}</strong>
                    <span>{item.userEmail || usersById.get(Number(item.userId))?.email || 'Sin correo'}</span>
                    <small>{item.reason || 'Sin motivo registrado'}</small>
                  </div>
                  <button className={`status-box status-${String(item.status || '').toLowerCase()}`} onClick={(e) => { e.stopPropagation(); openUserFromAuth(item); }}>
                    {authStatusLabel[item.status] || item.status}
                  </button>
                  {item.status === 'PENDING' && (
                    <div className="admin-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-primary" onClick={() => decideAuth(item.authorizationId, 'APPROVED')}>Aprobar</button>
                      <button className="btn btn-danger" onClick={() => decideAuth(item.authorizationId, 'REJECTED')}>Rechazar</button>
                    </div>
                  )}
                  <button
                    className="btn btn-danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      requestDelete('Solicitud de autorizacion', 'Se eliminara esta solicitud de autorizacion.', () => deleteAuthorizationRequest(item.authorizationId));
                    }}
                  >
                    Borrar
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-section">
            <h2>Solicitudes de adopcion</h2>
            <div className="admin-table">
              {filteredRequestsForTable.length === 0 ? <p className="empty-state">No hay solicitudes de adopcion.</p> : filteredRequestsForTable.map((item) => (
                <article key={item.requestId} className="admin-row request-admin-row" onClick={() => setSelectedRequest(item)}>
                  {item.petImageUrl && <img className="admin-thumb" src={item.petImageUrl} alt={item.petName || 'Perro'} />}
                  <div>
                    <strong>{item.petName || 'Mascota sin nombre'}</strong>
                    <span>Solicita: {item.contactName} - {item.contactEmail}</span>
                    <small>Publicado por {item.petOwnerName || 'No registrado'} - {formatDateTime(item.createdAt)}</small>
                  </div>
                  <span className={`status-box status-${String(item.status || '').toLowerCase()}`}>{requestStatusLabel[item.status] || item.status}</span>
                  <button
                    className="btn btn-danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      requestDelete(item.petName || 'Solicitud de adopcion', 'Se eliminara esta solicitud de adopcion.', () => deleteAdoptionRequestAdmin(item.requestId));
                    }}
                  >
                    Borrar
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-section">
            <h2>Reportes</h2>
            <div className="admin-table">
              {filteredReportsForTable.length === 0 ? <p className="empty-state">No hay reportes.</p> : filteredReportsForTable.map((report) => (
                <article key={report.reportId} className="admin-row report-admin-row" onClick={() => setSelectedReport(report)}>
                  {report.imageUrl && <img className="admin-thumb" src={report.imageUrl} alt={report.name || 'Reporte'} />}
                  <div className="admin-main-cell">
                    <strong>{report.name || 'Reporte sin nombre'}</strong>
                    <span>{reportTypeLabel[report.type] || report.type} - {report.location || 'Sin ubicacion'}</span>
                    <small>Publicado por {report.reporterName || 'No registrado'} - {formatDateTime(report.createdAt)}</small>
                  </div>
                  <span className={`status-box status-${String(report.status || '').toLowerCase()}`}>
                    {reportStatusLabel[report.status] || report.status}
                  </span>
                  <div className="admin-actions" onClick={(e) => e.stopPropagation()}>
                    {report.status === 'RESOLVED' ? (
                      <button className="btn btn-secondary" disabled={actionLoading !== ''} onClick={() => moderate(report.reportId, 'OPEN')}>Reabrir</button>
                    ) : (
                      <button className="btn btn-primary" disabled={actionLoading !== ''} onClick={() => moderate(report.reportId, 'RESOLVED')}>Cerrar caso</button>
                    )}
                    <button className="btn btn-danger" disabled={actionLoading !== ''} onClick={() => setReportToDelete(report)}>Borrar</button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-section">
            <div className="admin-section-header">
              <h2>Red neuronal</h2>
              <button className="btn btn-primary" disabled={reanalyzing} onClick={reanalyzeImages}>
                {reanalyzing ? 'Analizando fotos...' : 'Re-analizar fotos existentes'}
              </button>
            </div>
            <p className="admin-ai-text">
              Vuelve a analizar con el modelo actual las fotos de perros y reportes ya publicados
              (raza, "Otro" o no es perro) para que las coincidencias usen la nueva clasificacion.
              Usalo despues de actualizar el modelo; puede tardar unos minutos.
            </p>
            {reanalysisResult && (
              <p className="admin-ai-result">
                Fotos analizadas: {reanalysisResult.pets} de perros registrados y {reanalysisResult.reports} de reportes.
              </p>
            )}
            <h3 className="admin-ai-subtitle">Probar con tus fotos</h3>
            <p className="admin-ai-text">
              Sube fotos nuevas para ver qué detecta la red neuronal: si es un perro, raza (u "Otro"),
              tamaño, etapa (cachorro o adulto) y color.
            </p>
            <DogPhotoTester />
          </section>
        </>
      )}

      {selectedUser && profileData && (
        <div className="admin-modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <ModalHeader title={selectedUser.username} subtitle={selectedUser.email} onClose={() => setSelectedUser(null)} />
            <div className="admin-detail-grid">
              <div className="detail-info">
                <span>Rol</span>
                <select className="modal-role-select" value={selectedUser.role} onChange={(event) => changeSelectedUserRole(event.target.value)}>
                  <option value="USER">Usuario normal</option>
                  <option value="SHELTER">Refugio</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <Info label="Telefono" value={selectedUser.phone || 'No registrado'} />
              <Info label="Puede publicar" value={selectedUser.publishingAuthorized ? 'Si' : 'No'} />
              <Info label="Cuenta" value={selectedUser.accountActive ? 'Activa' : 'Inactiva'} />
            </div>
            <div className="profile-history">
              <History title="Solicitudes para publicar" items={profileData.authorizations} empty="Sin solicitudes de publicacion" render={(item) => `${authStatusLabel[item.status] || item.status} - ${formatDateTime(item.createdAt)} - ${item.reason || 'Sin motivo'}`} />
              <History title="Solicitudes de adopcion realizadas" items={profileData.adoptionRequests} empty="Sin solicitudes realizadas" render={(item) => `${item.petName || 'Mascota'} - ${requestStatusLabel[item.status] || item.status} - ${formatDateTime(item.createdAt)}`} />
              <History title="Reportes publicados" items={profileData.reports} empty="Sin reportes" render={(item) => `${item.name || 'Reporte'} - ${reportTypeLabel[item.type] || item.type} - ${reportStatusLabel[item.status] || item.status}`} />
            </div>
            <div className="admin-modal-footer">
              <button className="btn btn-secondary" onClick={() => togglePublishing(selectedUser.id, !selectedUser.publishingAuthorized)}>
                {selectedUser.publishingAuthorized ? 'Quitar permiso' : 'Autorizar publicar'}
              </button>
              <button className="btn btn-danger" onClick={() => toggleAccount(selectedUser.id, !selectedUser.accountActive)}>
                {selectedUser.accountActive ? 'Desactivar' : 'Activar'}
              </button>
              <button className="btn btn-danger" onClick={() => requestDelete(selectedUser.username, 'Se eliminara este usuario definitivamente.', () => deleteUser(selectedUser.id))}>Borrar usuario</button>
            </div>
          </div>
        </div>
      )}

      {selectedAuthorization && (
        <AdminDetailModal title="Autorizacion para publicar" subtitle={selectedAuthorization.username || 'Usuario'} onClose={() => setSelectedAuthorization(null)}>
          <Info label="Usuario" value={selectedAuthorization.username || 'Sin nombre'} />
          <Info label="Correo" value={selectedAuthorization.userEmail || 'Sin correo'} />
          <Info label="Estado" value={authStatusLabel[selectedAuthorization.status] || selectedAuthorization.status} />
          <Info label="Fecha" value={formatDateTime(selectedAuthorization.createdAt)} />
          <div className="detail-full"><span>Motivo</span><p>{selectedAuthorization.reason || 'Sin motivo registrado'}</p></div>
          {selectedAuthorization.status === 'PENDING' && (
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => decideAuth(selectedAuthorization.authorizationId, 'APPROVED')}>Aprobar</button>
              <button className="btn btn-danger" onClick={() => decideAuth(selectedAuthorization.authorizationId, 'REJECTED')}>Rechazar</button>
            </div>
          )}
          <div className="modal-actions">
            <button className="btn btn-danger" onClick={() => requestDelete('Solicitud de autorizacion', 'Se eliminara esta solicitud de autorizacion.', () => deleteAuthorizationRequest(selectedAuthorization.authorizationId))}>Borrar solicitud</button>
          </div>
        </AdminDetailModal>
      )}

      {selectedRequest && (
        <AdminDetailModal title={selectedRequest.petName || 'Solicitud de adopcion'} subtitle={`Solicita ${selectedRequest.contactName || 'usuario'}`} onClose={() => setSelectedRequest(null)}>
          {selectedRequest.petImageUrl && <img className="detail-hero-image" src={selectedRequest.petImageUrl} alt={selectedRequest.petName || 'Perro'} />}
          <Info label="Estado" value={requestStatusLabel[selectedRequest.status] || selectedRequest.status} />
          <Info label="Publicado por" value={selectedRequest.petOwnerName || 'No registrado'} />
          <Info label="Solicitante" value={selectedRequest.contactName || 'No registrado'} />
          <Info label="Correo" value={selectedRequest.contactEmail || 'No registrado'} />
          <Info label="Telefono" value={selectedRequest.contactPhone || 'No registrado'} />
          <Info label="Fecha" value={formatDateTime(selectedRequest.createdAt)} />
          <div className="detail-full"><span>Mensaje</span><p>{selectedRequest.message || 'Sin mensaje adicional'}</p></div>
          <div className="modal-actions">
            <button className="btn btn-danger" onClick={() => requestDelete(selectedRequest.petName || 'Solicitud de adopcion', 'Se eliminara esta solicitud de adopcion.', () => deleteAdoptionRequestAdmin(selectedRequest.requestId))}>Borrar solicitud</button>
          </div>
        </AdminDetailModal>
      )}

      {selectedReport && (
        <AdminDetailModal title={selectedReport.name || 'Reporte'} subtitle={`${reportTypeLabel[selectedReport.type] || selectedReport.type} - ${reportStatusLabel[selectedReport.status] || selectedReport.status}`} onClose={() => setSelectedReport(null)}>
          {selectedReport.imageUrl && <img className="detail-hero-image" src={selectedReport.imageUrl} alt={selectedReport.name || 'Reporte'} />}
          <Info label="Publicado por" value={selectedReport.reporterName || 'No registrado'} />
          <Info label="Correo" value={selectedReport.reporterEmail || 'No registrado'} />
          <Info label="Ubicacion" value={selectedReport.location || 'No registrada'} />
          <Info label="Fecha" value={formatDateTime(selectedReport.createdAt)} />
          <Info label="Raza" value={selectedReport.breed || 'No especificada'} />
          <Info label="Sexo" value={selectedReport.sex === 'MALE' ? 'Macho' : selectedReport.sex === 'FEMALE' ? 'Hembra' : 'No especificado'} />
          <Info label="Color" value={selectedReport.color || 'No especificado'} />
          <Info label="Telefono" value={selectedReport.contactPhone || 'No registrado'} />
          <div className="detail-full"><span>Descripcion</span><p>{selectedReport.description || 'Sin descripcion'}</p></div>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={() => window.location.assign(`/reporte/${selectedReport.reportId}`)}>Ir al detalle</button>
            {selectedReport.status === 'RESOLVED' ? (
              <button className="btn btn-secondary" onClick={() => moderate(selectedReport.reportId, 'OPEN')}>Reabrir</button>
            ) : (
              <button className="btn btn-secondary" onClick={() => moderate(selectedReport.reportId, 'RESOLVED')}>Cerrar caso</button>
            )}
            <button className="btn btn-danger" onClick={() => setReportToDelete(selectedReport)}>Borrar</button>
          </div>
        </AdminDetailModal>
      )}

      {reportToDelete && (
        <AdminDetailModal
          title="Borrar reporte"
          subtitle={reportToDelete.name || 'Reporte seleccionado'}
          onClose={() => setReportToDelete(null)}
        >
          <div className="detail-full">
            <span>Confirmacion</span>
            <p>Esta accion eliminara el reporte definitivamente.</p>
          </div>
          <Info label="Tipo" value={reportTypeLabel[reportToDelete.type] || reportToDelete.type} />
          <Info label="Ubicacion" value={reportToDelete.location || 'No registrada'} />
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setReportToDelete(null)} disabled={actionLoading !== ''}>Cancelar</button>
            <button className="btn btn-danger" onClick={() => removeReport(reportToDelete.reportId)} disabled={actionLoading !== ''}>
              {actionLoading ? 'Borrando...' : 'Borrar definitivamente'}
            </button>
          </div>
        </AdminDetailModal>
      )}

      {deleteTarget && (
        <AdminDetailModal title="Confirmar borrado" subtitle={deleteTarget.title} onClose={() => setDeleteTarget(null)}>
          <div className="detail-full">
            <span>Accion definitiva</span>
            <p>{deleteTarget.description}</p>
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={actionLoading !== ''}>Cancelar</button>
            <button className="btn btn-danger" onClick={confirmDeleteTarget} disabled={actionLoading !== ''}>
              {actionLoading ? 'Borrando...' : 'Borrar definitivamente'}
            </button>
          </div>
        </AdminDetailModal>
      )}
    </div>
  );
};

const ModalHeader = ({ title, subtitle, onClose }) => (
  <div className="admin-modal-header">
    <div>
      <h3>{title}</h3>
      <p>{subtitle}</p>
    </div>
    <button type="button" onClick={onClose}>x</button>
  </div>
);

const AdminDetailModal = ({ title, subtitle, onClose, children }) => (
  <div className="admin-modal-overlay" onClick={onClose}>
    <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
      <ModalHeader title={title} subtitle={subtitle} onClose={onClose} />
      <div className="admin-detail-grid">{children}</div>
    </div>
  </div>
);

const Info = ({ label, value }) => (
  <div className="detail-info">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const Metric = ({ value, label, active, onClick }) => (
  <button type="button" className={active ? 'active' : ''} onClick={onClick}>
    <strong>{value}</strong>
    <span>{label}</span>
  </button>
);

const ReportChart = ({ title, items }) => {
  const max = Math.max(1, ...items.map(([, value]) => Number(value) || 0));
  return (
    <div className="admin-chart-card">
      <h3>{title}</h3>
      {items.map(([label, value]) => (
        <div className="admin-bar-row" key={label}>
          <span>{label}</span>
          <div className="admin-bar-track">
            <div className="admin-bar-fill" style={{ width: `${Math.max(6, ((Number(value) || 0) / max) * 100)}%` }} />
          </div>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
};

const MiniTable = ({ title, headers, rows }) => (
  <div className="admin-mini-table">
    <h3>{title}</h3>
    <table>
      <thead>
        <tr>
          {headers.map((header) => <th key={header}>{header}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={headers.length}>Sin datos</td></tr>
        ) : rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const History = ({ title, items, empty, render }) => (
  <section>
    <h4>{title}</h4>
    {items.length === 0 ? (
      <p>{empty}</p>
    ) : (
      items.map((item, index) => <p key={index}>{render(item)}</p>)
    )}
  </section>
);

export default AdminPanel;
