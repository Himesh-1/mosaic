"use client";

import React from "react";
import { QRCodeSVG } from "qrcode.react";

interface QRCodeDisplayProps {
  value: string;
  size?: number;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 200,
}) => {
  return (
    <div
      style={{
        padding: "16px",
        backgroundColor: "#FFFFFF",
        borderRadius: "var(--mosaic-radius-md)",
        border: "1px solid var(--mosaic-color-border-subtle)",
        boxShadow: "var(--mosaic-shadow-sm)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-label="QR Code to join Space"
    >
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        includeMargin={false}
        fgColor="var(--mosaic-color-text-primary)"
        bgColor="#FFFFFF"
      />
    </div>
  );
};
