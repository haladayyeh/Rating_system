import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) {
      setReady(true);
      return;
    }
    api("/auth/me")
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setReady(true));
  }, [logout]);

  const login = useCallback(async (loginName, password) => {
    const { token, user } = await api("/auth/login", {
      method: "POST",
      body: { login: loginName, password },
    });
    tokenStore.set(token);
    setUser(user);
    return user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
