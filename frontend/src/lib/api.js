import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;
const STAFF_SESSION_KEY = "bbr_staff_session";

/** Read the JWT staff token from the localStorage session envelope. */
export function getStaffToken() {
  try {
    const raw = localStorage.getItem(STAFF_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token || null;
  } catch {
    return null;
  }
}

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = getStaffToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      // token invalid - the AuthContext will handle clearing on next render
    }
    return Promise.reject(err);
  }
);

export default api;
