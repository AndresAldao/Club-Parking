// src/lib/auth.js
export function getToken() {
  return localStorage.getItem("token") || null;
}

export function setToken(tk) {
  if (tk) localStorage.setItem("token", tk);
}

export function clearToken() {
  localStorage.removeItem("token");
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setCurrentUser(u) {
  if (u) localStorage.setItem("user", JSON.stringify(u));
}

export function isAuthenticated() {
  return !!getToken();
}
