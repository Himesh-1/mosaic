"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  UserProfile,
  DeviceSessionInfo,
  LoginRequest,
  RegisterRequest,
  GuestJoinRequest,
} from "@mosaic/contracts";
import { api } from "../lib/api";

interface AuthContextType {
  user: UserProfile | null;
  session: DeviceSessionInfo | null;
  isLoading: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  guestLogin: (payload: GuestJoinRequest) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<DeviceSessionInfo | null>(() => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("mosaic_session_token");
      if (savedToken) {
        return {
          id: "",
          token: savedToken,
          last_seen_at: "",
          expires_at: "",
        };
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  const saveToken = (s?: DeviceSessionInfo | null) => {
    if (typeof window !== "undefined") {
      if (s?.token) {
        localStorage.setItem("mosaic_session_token", s.token);
      } else if (s?.id) {
        localStorage.setItem("mosaic_session_token", s.id);
      }
    }
  };

  const removeToken = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("mosaic_session_token");
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const data = await api.getMe();
      setUser(data.user);
      setSession(data.session);
      saveToken(data.session);
    } catch {
      setUser(null);
      setSession(null);
      removeToken();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (payload: LoginRequest) => {
    const data = await api.login(payload);
    setUser(data.user);
    setSession(data.session);
    saveToken(data.session);
  };

  const register = async (payload: RegisterRequest) => {
    const data = await api.register(payload);
    setUser(data.user);
    setSession(data.session);
    saveToken(data.session);
  };

  const guestLogin = async (payload: GuestJoinRequest) => {
    const data = await api.guestLogin(payload);
    setUser(data.user);
    setSession(data.session);
    saveToken(data.session);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setSession(null);
    removeToken();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        login,
        register,
        guestLogin,
        logout,
        refresh: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
