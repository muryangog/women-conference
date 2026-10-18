import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});
const body = Outfit({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Urugori rw'igisagara — Inscription gratuite",
  description:
    "Ijwi risamirana ku marembo. Conférence des femmes, 24 octobre 2026 à 14h00, Kinindo Large. Inscris-toi gratuitement.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#B8205A" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
