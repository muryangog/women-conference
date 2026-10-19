"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function Qr({ value, size = 160 }: { value: string; size?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: "M" }).then(setSrc).catch(() => setSrc(""));
  }, [value, size]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} width={size} height={size} alt="QR code d'entrée" /> : <div style={{ width: size, height: size }} />;
}
