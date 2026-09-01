"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, LogIn, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { StatusChip } from "./StatusChip";

interface HeaderProps {
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAuth }) => {
  const { user, session, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: "var(--mosaic-z-header)",
        backgroundColor: "var(--mosaic-color-surface-base)",
        borderBottom: "1px solid var(--mosaic-color-border-subtle)",
        boxShadow: "var(--mosaic-shadow-sm)",
      }}
    >
      <div
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "64px",
        }}
      >
        {/* Brand */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "var(--mosaic-color-text-primary)",
            fontWeight: 700,
            fontSize: "1.25rem",
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "var(--mosaic-radius-sm)",
              backgroundColor: "var(--mosaic-color-brand-primary)",
              color: "#FFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles size={18} />
          </div>
          <span>Mosaic</span>
        </Link>

        {/* Right Area: Status & User */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <StatusChip status="connected" label="Connected" />

          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Avatar name={user.display_name} size="sm" status="online" />
              <div
                style={{ display: "none", flexDirection: "column" }}
                className="user-label"
              >
                <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                  {user.display_name}
                </span>
                {session?.device_label && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--mosaic-color-text-muted)",
                    }}
                  >
                    {session.device_label}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                isLoading={isLoggingOut}
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={onOpenAuth}>
              <LogIn size={16} />
              <span>Sign in</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
