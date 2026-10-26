const API_BASE_URL = 'http://localhost:8080';

const normalizeImageUrl = (imageUrl) => {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('data:')) {
    return imageUrl;
  }
  return imageUrl.startsWith('/') ? `${API_BASE_URL}${imageUrl}` : imageUrl;
};

const normalizeReport = (report) => report
  ? { ...report, imageUrl: normalizeImageUrl(report.imageUrl) }
  : report;

const normalizeAdoptionRequest = (request) => request
  ? { ...request, petImageUrl: normalizeImageUrl(request.petImageUrl) }
  : request;

const normalizeMatch = (match) => match
  ? { ...match, imageUrl: normalizeImageUrl(match.imageUrl) }
  : match;

const normalizeSighting = (sighting) => sighting
  ? { ...sighting, imageUrls: (sighting.imageUrls || []).map(normalizeImageUrl) }
  : sighting;

const normalizeCase = (caseItem) => caseItem
  ? {
      ...caseItem,
      imageUrl: normalizeImageUrl(caseItem.imageUrl),
      messages: (caseItem.messages || []).map((message) => ({
        ...message,
        imageUrls: (message.imageUrls || []).map(normalizeImageUrl),
      })),
    }
  : caseItem;

const request = async (path, options = {}) => {
  const token = localStorage.getItem('token');
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(!isFormData && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers || {}),
    },
  });

  // Sesión expirada o inválida: limpiar y mandar a login.
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Error HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json().catch(() => null);
};

export const getUsers = () => request('/users');
export const deleteUser = (userId) => request(`/users/${userId}`, { method: 'DELETE' });
export const updateUserRole = (userId, role) =>
  request(`/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
export const updatePublishingAuthorization = (userId, authorized) =>
  request(`/users/${userId}/publishing-authorization`, { method: 'PATCH', body: JSON.stringify({ authorized }) });
export const updateAccountStatus = (userId, active) =>
  request(`/users/${userId}/status`, { method: 'PATCH', body: JSON.stringify({ active }) });

export const getPetsByOwner = (ownerId) => request(`/pets/owner/${ownerId}`);
export const deactivatePet = (petId) => request(`/pets/${petId}/deactivate`, { method: 'PATCH' });

export const createAdoptionRequest = (data) =>
  request('/adoption-requests', { method: 'POST', body: JSON.stringify(data) });
export const getAdoptionRequestsByUser = async (userId) => {
  const requests = await request(`/adoption-requests/user/${userId}`);
  return (requests || []).map(normalizeAdoptionRequest);
};
export const getAdoptionRequestsByOwner = async (ownerId) => {
  const requests = await request(`/adoption-requests/owner/${ownerId}`);
  return (requests || []).map(normalizeAdoptionRequest);
};
export const getAllAdoptionRequests = async () => {
  const requests = await request('/adoption-requests');
  return (requests || []).map(normalizeAdoptionRequest);
};
export const decideAdoptionRequest = (requestId, status, notes = '') =>
  request(`/adoption-requests/${requestId}/decision`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  });
export const cancelAdoptionRequest = (requestId, userId) =>
  request(`/adoption-requests/${requestId}?userId=${userId}`, { method: 'DELETE' });
export const deleteAdoptionRequestAdmin = (requestId) =>
  request(`/adoption-requests/${requestId}/admin`, { method: 'DELETE' });

export const createAuthorizationRequest = (data) =>
  request('/publication-authorizations', { method: 'POST', body: JSON.stringify(data) });
export const getAuthorizationRequestsByUser = (userId) => request(`/publication-authorizations/user/${userId}`);
export const getAllAuthorizationRequests = () => request('/publication-authorizations');
export const decideAuthorizationRequest = (authorizationId, status, notes = '') =>
  request(`/publication-authorizations/${authorizationId}/decision`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  });
export const deleteAuthorizationRequest = (authorizationId) =>
  request(`/publication-authorizations/${authorizationId}`, { method: 'DELETE' });

export const createReport = (data) => {
  const imageFile = data.imageFile;
  const reportPayload = { ...data };
  delete reportPayload.imageFile;

  if (!imageFile) {
    return request('/reports', { method: 'POST', body: JSON.stringify(reportPayload) });
  }

  const multipartData = new FormData();
  multipartData.append(
    'report',
    new Blob([JSON.stringify(reportPayload)], { type: 'application/json' })
  );
  multipartData.append('image', imageFile);
  return request('/reports', { method: 'POST', body: multipartData });
};
// Analisis de una foto con la red neuronal (via backend -> ml-service): indica si es
// un perro (o que es) y sugiere raza u "Otro", tamano, edad y color.
export const analyzeDogImage = (file) => {
  const multipartData = new FormData();
  multipartData.append('image', file);
  return request('/images/analyze', { method: 'POST', body: multipartData });
};
// Solo admin: vuelve a analizar con el modelo actual TODAS las fotos ya guardadas
// (mascotas y reportes) para actualizar la raza que usa el matching.
export const reanalyzeStoredImages = async () => {
  const pets = await request('/pets/embeddings/backfill?force=true', { method: 'POST' });
  const reports = await request('/reports/embeddings/backfill?force=true', { method: 'POST' });
  return { pets: pets?.processed ?? 0, reports: reports?.processed ?? 0 };
};
export const getReports = async (type) => {
  const reports = await request(`/reports${type ? `?type=${type}` : ''}`);
  return (reports || []).map(normalizeReport);
};
export const getReportDetails = async (reportId) => normalizeReport(await request(`/reports/${reportId}`));
export const getReportsByUser = async (userId) => {
  const reports = await request(`/reports/user/${userId}`);
  return (reports || []).map(normalizeReport);
};
export const updateReport = (reportId, data) => {
  const imageFile = data.imageFile;
  const reportPayload = { ...data };
  delete reportPayload.imageFile;

  if (!imageFile) {
    return request(`/reports/${reportId}`, { method: 'PUT', body: JSON.stringify(reportPayload) });
  }

  const multipartData = new FormData();
  multipartData.append(
    'report',
    new Blob([JSON.stringify(reportPayload)], { type: 'application/json' })
  );
  multipartData.append('image', imageFile);
  return request(`/reports/${reportId}`, { method: 'PUT', body: multipartData });
};
export const moderateReport = (reportId, status, notes = '') =>
  request(`/reports/${reportId}/moderation`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  });
export const deleteReport = (reportId) =>
  request(`/reports/${reportId}`, { method: 'DELETE' });
export const getReportMatches = async (reportId) => {
  const matches = await request(`/reports/${reportId}/matches`);
  return (matches || []).map(normalizeMatch);
};
export const updateMatchStatus = (matchId, status) =>
  request(`/reports/matches/${matchId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
export const getPetMatches = async (petId) => {
  const matches = await request(`/pets/${petId}/matches`);
  return (matches || []).map(normalizeMatch);
};

export const createReportSighting = (reportId, data) => {
  const imageFiles = Array.isArray(data.imageFiles) ? data.imageFiles.filter(Boolean).slice(0, 4) : [];
  const payload = { ...data };
  delete payload.imageFiles;

  const multipartData = new FormData();
  multipartData.append(
    'sighting',
    new Blob([JSON.stringify(payload)], { type: 'application/json' })
  );
  imageFiles.forEach((file) => multipartData.append('images', file));

  return request(`/reports/${reportId}/sightings`, { method: 'POST', body: multipartData });
};

export const getReportSightingsByOwner = async (ownerId) => {
  const sightings = await request(`/reports/sightings/owner/${ownerId}`);
  return (sightings || []).map(normalizeSighting);
};

export const getAllReportSightings = async () => {
  const sightings = await request('/reports/sightings');
  return (sightings || []).map(normalizeSighting);
};

export const replyReportSighting = (sightingId, reply, status = 'REPLIED') =>
  request(`/reports/sightings/${sightingId}/reply`, {
    method: 'PATCH',
    body: JSON.stringify({ reply, status }),
  });

export const updateReportSightingCase = (sightingId, status, reply = '') =>
  request(`/reports/sightings/${sightingId}/case`, {
    method: 'PATCH',
    body: JSON.stringify({ reply, status }),
  });

export const getCasesByUser = async (userId) => {
  const cases = await request(`/cases/user/${userId}`);
  return (cases || []).map(normalizeCase);
};
export const getAllCases = async () => {
  const cases = await request('/cases');
  return (cases || []).map(normalizeCase);
};
export const getCaseDetails = async (caseId) => normalizeCase(await request(`/cases/${caseId}`));
export const createAdoptionCase = async (requestId) =>
  normalizeCase(await request(`/cases/adoption/${requestId}`, { method: 'POST' }));
export const createSightingCase = async (sightingId) =>
  normalizeCase(await request(`/cases/sighting/${sightingId}`, { method: 'POST' }));
export const addCaseMessage = async (caseId, senderId, message, imageFiles = []) => {
  const files = Array.isArray(imageFiles) ? imageFiles.filter(Boolean).slice(0, 4) : [];

  if (files.length > 0) {
    const multipartData = new FormData();
    multipartData.append(
      'message',
      new Blob([JSON.stringify({ senderId, message })], { type: 'application/json' })
    );
    files.forEach((file) => multipartData.append('images', file));
    return normalizeCase(await request(`/cases/${caseId}/messages`, {
      method: 'POST',
      body: multipartData,
    }));
  }

  return normalizeCase(await request(`/cases/${caseId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ senderId, message }),
  }));
};
export const updateCaseStatus = async (caseId, status, actorId, message = '') =>
  normalizeCase(await request(`/cases/${caseId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, actorId, message }),
  }));
export const deleteCaseAdmin = (caseId) => request(`/cases/${caseId}`, { method: 'DELETE' });
export const getNotificationSummary = (userId) => request(`/cases/notifications/${userId}`);

// Notificaciones dirigidas al usuario (mensajes en casos, decisiones, avisos, coincidencias).
export const getNotifications = (userId) => request(`/notifications/user/${userId}`);
export const getUnreadNotificationCount = (userId) => request(`/notifications/user/${userId}/unread-count`);
export const markNotificationRead = (id) => request(`/notifications/${id}/read`, { method: 'PATCH' });
export const markAllNotificationsRead = (userId) =>
  request(`/notifications/user/${userId}/read-all`, { method: 'PATCH' });
