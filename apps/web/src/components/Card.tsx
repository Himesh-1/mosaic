"use client";

import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg" | "none";
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = "md",
  style,
  ...props
}) => {
  const getPadding = () => {
    switch (padding) {
      case "none":
        return 0;
      case "sm":
        return "var(--mosaic-space-3)";
      case "md":
        return "var(--mosaic-space-5)";
      case "lg":
        return "var(--mosaic-space-6)";
    }
  };

  return (
    <div
      style={{
        backgroundColor: "var(--mosaic-color-surface-base)",
        borderRadius: "var(--mosaic-radius-md)",
        border: "1px solid var(--mosaic-color-border-subtle)",
        boxShadow: "var(--mosaic-shadow-sm)",
        padding: getPadding(),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
