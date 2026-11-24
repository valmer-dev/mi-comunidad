import type { Metadata, Viewport } from "next";
import { Lexend, Source_Sans_3 } from "next/font/google";
import { CapturarInstalacion } from "@/components/pwa/CapturarInstalacion";
import { RegistrarServiceWorker } from "@/components/pwa/RegistrarServiceWorker";
import "./globals.css";

// Pareja tipografica pensada para leerse bien a cualquier edad:
// Lexend en titulos y Source Sans 3 en el texto.
const fuenteTitulos = Lexend({
  variable: "--font-titulos",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const fuenteTexto = Source_Sans_3({
  variable: "--font-texto",
  subsets: ["latin"],
  display: "swap",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1113" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  // Android 15+ dibuja de borde a borde: sin esto la barra inferior
  // puede quedar debajo de la barra de gestos.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${fuenteTitulos.variable} ${fuenteTexto.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <RegistrarServiceWorker />
        <CapturarInstalacion />
      </body>
    </html>
  );
}
