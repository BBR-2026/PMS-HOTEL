import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const StaffAuthContext = createContext(null);
const STORAGE_KEY = "bbr_staff_session";

export function StaffAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const s = JSON.parse(raw);
        setUser(s.user);
        setToken(s.token);
        api.defaults.headers.common["Authorization"] = `Bearer ${s.token}`;
      } catch {}
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/staff/login", { email, password });
    setUser(data.user);
    setToken(data.access_token);
    api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: data.user, token: data.access_token }));
    return data.user;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    delete api.defaults.headers.common["Authorization"];
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <StaffAuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </StaffAuthContext.Provider>
  );
}

export const useStaffAuth = () => useContext(StaffAuthContext);
