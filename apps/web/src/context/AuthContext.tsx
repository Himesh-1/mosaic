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
  const [session, setSession] = useState<DeviceSessionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const data = await api.getMe();
      setUser(data.user);
      setSession(data.session);
    } catch {
      setUser(null);
      setSession(null);
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
  };

  const register = async (payload: RegisterRequest) => {
    const data = await api.register(payload);
    setUser(data.user);
    setSession(data.session);
  };

  const guestLogin = async (payload: GuestJoinRequest) => {
    const data = await api.guestLogin(payload);
    setUser(data.user);
    setSession(data.session);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setSession(null);
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
