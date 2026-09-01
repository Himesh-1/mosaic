"use client";

import React from "react";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  status?: "online" | "away" | "offline";
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  size = "md",
  status,
}) => {
  const getInitials = (n: string) => {
    const parts = n.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  const getDimension = () => {
    switch (size) {
      case "sm":
        return 32;
      case "md":
        return 40;
      case "lg":
        return 52;
    }
  };

  const dim = getDimension();

  return (
    <div
      style={{
        position: "relative",
        width: `${dim}px`,
        height: `${dim}px`,
        borderRadius: "var(--mosaic-radius-full)",
        backgroundColor: "var(--mosaic-color-brand-subtle)",
        color: "var(--mosaic-color-brand-strong)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize:
          size === "sm" ? "0.75rem" : size === "md" ? "0.875rem" : "1.125rem",
        boxShadow: "var(--mosaic-shadow-sm)",
      }}
      aria-label={`Avatar for ${name}`}
    >
      {getInitials(name)}
      {status && (
        <span
          style={{
            position: "absolute",
            bottom: "0",
            right: "0",
            width: size === "sm" ? "8px" : "10px",
            height: size === "sm" ? "8px" : "10px",
            borderRadius: "50%",
            backgroundColor:
              status === "online"
                ? "var(--mosaic-color-status-success)"
                : status === "away"
                  ? "var(--mosaic-color-status-warning)"
                  : "var(--mosaic-color-text-muted)",
            border: "2px solid var(--mosaic-color-surface-base)",
          }}
          title={status}
        />
      )}
    </div>
  );
};
