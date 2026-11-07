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

  // beforeEnter (optional): awaited after the password is accepted but before the app
  // switches to the dashboard, e.g. the login page's short "unlock" animation
  const login = useCallback(async (loginName, password, beforeEnter) => {
    const { token, user } = await api("/auth/login", {
      method: "POST",
      body: { login: loginName, password },
    });
    tokenStore.set(token);
    if (beforeEnter) await beforeEnter(user);
    setUser(user);
    return user;
  }, []);

  // Merge changes into the signed-in user (e.g. after editing the nickname badge)
  const updateUser = useCallback((patch) => setUser((u) => (u ? { ...u, ...patch } : u)), []);

  return (
    <AuthContext.Provider value={{ user, ready, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
