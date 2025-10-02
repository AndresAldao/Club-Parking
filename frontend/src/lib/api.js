// src/lib/api.js
import axios from "axios";
import { getToken, clearToken } from "./auth";

const api = axios.create({
  baseURL: "http://localhost:4000/api",
});

api.interceptors.request.use((config) => {
  const tk = getToken();
  if (tk) config.headers.Authorization = `Bearer ${tk}`;
  return config;
});

api.interceptors.response.use(
  (resp) => resp,
  (err) => {
    // Si el token venció o no es válido, anulamos sesión y vamos al login
    if (err?.response?.status === 401) {
      clearToken();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
