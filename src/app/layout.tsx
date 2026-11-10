import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { CapturarInstalacion } from "@/components/pwa/CapturarInstalacion";
import { RegistrarServiceWorker } from "@/components/pwa/RegistrarServiceWorker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Mi Comunidad",
    template: "%s · Mi Comunidad",
  },
  description: "Gestión de la comunidad de vecinos: vecinos, cuotas, juntas, incidencias y documentos.",
  applicationName: "Mi Comunidad",
  appleWebApp: {
    capable: true,
    title: "Mi Comunidad",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/iconos/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/iconos/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/iconos/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  // Android 15+ dibuja de borde a borde: sin esto la barra inferior
  // puede quedar debajo de la barra de gestos.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <RegistrarServiceWorker />
        <CapturarInstalacion />
      </body>
    </html>
  );
}
