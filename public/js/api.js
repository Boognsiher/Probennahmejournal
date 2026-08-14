// api.js — Zugriff auf den Probennahmejournal-Server (Login, Proben, Fotos, Grenzwerte, Benutzer).
const TOKEN_KEY = 'pnj_token';
const USER_KEY = 'pnj_user';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}
export function isLoggedIn() { return !!getToken(); }
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch (networkErr) {
    throw new ApiError('Keine Verbindung zum Server. Bitte Internet-/Netzwerkverbindung prüfen.', 0);
  }

  if (res.status === 401) {
    logout();
    throw new ApiError('Sitzung abgelaufen. Bitte erneut anmelden.', 401);
  }
  if (res.status === 204) return null;

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : null;
  if (!res.ok) throw new ApiError((data && data.error) || `Fehler (${res.status})`, res.status);
  return data;
}

export { ApiError };

// ---------- Auth ----------
export async function login(email, password) {
  const data = await request('/auth/login', { method: 'POST', body: { email, password } });
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

// ---------- Einträge ----------
export async function listEntries() {
  const data = await request('/entries');
  return data.entries;
}
export async function getEntryApi(id) {
  const data = await request(`/entries/${id}`);
  return data.entry;
}
export async function createEntryApi(entry) {
  const data = await request('/entries', { method: 'POST', body: entry });
  return data.entry;
}
export async function updateEntryApi(id, entry) {
  const data = await request(`/entries/${id}`, { method: 'PUT', body: entry });
  return data.entry;
}
export async function deleteEntryApi(id) {
  await request(`/entries/${id}`, { method: 'DELETE' });
}

// ---------- Fotos ----------
export async function uploadPhotos(entryId, files) {
  const form = new FormData();
  for (const f of files) form.append('photos', f, f.name);
  const data = await request(`/entries/${entryId}/photos`, { method: 'POST', body: form, isForm: true });
  return data.photos;
}
export async function deletePhotoApi(entryId, photoId) {
  await request(`/entries/${entryId}/photos/${photoId}`, { method: 'DELETE' });
}
export async function fetchPhotoBlob(entryId, photoId) {
  const token = getToken();
  const res = await fetch(`/api/entries/${entryId}/photos/${photoId}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError('Foto konnte nicht geladen werden.', res.status);
  return res.blob();
}

// ---------- Grenzwerte ----------
export async function getThresholdsApi() {
  const data = await request('/settings/thresholds');
  return data.thresholds;
}
export async function saveThresholdsApi(thresholds) {
  await request('/settings/thresholds', { method: 'PUT', body: { thresholds } });
}
export async function resetThresholdsApi() {
  const data = await request('/settings/thresholds/reset', { method: 'POST' });
  return data.thresholds;
}

// ---------- Parameter (Grenzwerte-Zeilen) ----------
export async function getParametersApi() {
  const data = await request('/settings/parameters');
  return data.parameters;
}
export async function saveParametersApi(parameters) {
  await request('/settings/parameters', { method: 'PUT', body: { parameters } });
}
export async function resetParametersApi() {
  const data = await request('/settings/parameters/reset', { method: 'POST' });
  return data.parameters;
}

// ---------- VBBo-Grenzwerte ----------
export async function getVbboThresholdsApi() {
  const data = await request('/settings/vbbo-thresholds');
  return data.thresholds;
}
export async function saveVbboThresholdsApi(thresholds) {
  await request('/settings/vbbo-thresholds', { method: 'PUT', body: { thresholds } });
}
export async function resetVbboThresholdsApi() {
  const data = await request('/settings/vbbo-thresholds/reset', { method: 'POST' });
  return data.thresholds;
}

// ---------- VBBo-Parameter ----------
export async function getVbboParametersApi() {
  const data = await request('/settings/vbbo-parameters');
  return data.parameters;
}
export async function saveVbboParametersApi(parameters) {
  await request('/settings/vbbo-parameters', { method: 'PUT', body: { parameters } });
}
export async function resetVbboParametersApi() {
  const data = await request('/settings/vbbo-parameters/reset', { method: 'POST' });
  return data.parameters;
}

// ---------- VeVA-Codes ----------
export async function getVevaCodesApi() {
  const data = await request('/settings/veva-codes');
  return data.codes;
}
export async function saveVevaCodesApi(codes) {
  await request('/settings/veva-codes', { method: 'PUT', body: { codes } });
}
export async function resetVevaCodesApi() {
  const data = await request('/settings/veva-codes/reset', { method: 'POST' });
  return data.codes;
}

// ---------- Benutzer (Admin) ----------
export async function listUsersApi() {
  const data = await request('/users');
  return data.users;
}
export async function createUserApi(user) {
  const data = await request('/users', { method: 'POST', body: user });
  return data.user;
}
export async function deleteUserApi(id) {
  await request(`/users/${id}`, { method: 'DELETE' });
}
export async function getUserRosterApi() {
  const data = await request('/users/roster');
  return data.users;
}

// ---------- Projekte ----------
export async function listProjectsApi() {
  const data = await request('/projects');
  return data.projects;
}
export async function createProjectApi(project) {
  const data = await request('/projects', { method: 'POST', body: project });
  return data.project;
}
export async function updateProjectApi(id, project) {
  const data = await request(`/projects/${id}`, { method: 'PUT', body: project });
  return data.project;
}
export async function deleteProjectApi(id) {
  await request(`/projects/${id}`, { method: 'DELETE' });
}
