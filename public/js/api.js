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
