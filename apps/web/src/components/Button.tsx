"use client";

import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  style,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case "primary":
        return {
          backgroundColor: "var(--mosaic-color-brand-primary)",
          color: "var(--mosaic-color-text-inverse)",
          boxShadow: "var(--mosaic-shadow-sm)",
        };
      case "secondary":
        return {
          backgroundColor: "var(--mosaic-color-surface-base)",
          color: "var(--mosaic-color-text-primary)",
          border: "1px solid var(--mosaic-color-border-subtle)",
          boxShadow: "var(--mosaic-shadow-sm)",
        };
      case "ghost":
        return {
          backgroundColor: "transparent",
          color: "var(--mosaic-color-text-primary)",
        };
      case "danger":
        return {
          backgroundColor: "var(--mosaic-color-status-danger)",
          color: "var(--mosaic-color-text-inverse)",
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case "sm":
        return {
          padding: "6px 12px",
          fontSize: "0.875rem",
          minHeight: "36px",
          borderRadius: "var(--mosaic-radius-sm)",
        };
      case "md":
        return {
          padding: "10px 18px",
          fontSize: "0.9375rem",
          minHeight: "44px",
          borderRadius: "var(--mosaic-radius-md)",
        };
      case "lg":
        return {
          padding: "14px 24px",
          fontSize: "1.0625rem",
          minHeight: "52px",
          borderRadius: "var(--mosaic-radius-md)",
        };
    }
  };

  return (
    <button
      disabled={disabled || isLoading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        fontWeight: 600,
        transition: "all 0.15s ease",
        cursor: disabled || isLoading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      {...props}
    >
      {isLoading && (
        <span
          style={{
            display: "inline-block",
            width: "16px",
            height: "16px",
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
          }}
        />
      )}
      {children}
    </button>
  );
};
