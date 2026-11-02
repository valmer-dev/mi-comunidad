import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...entradas: ClassValue[]) {
  return twMerge(clsx(entradas));
}

export function formatoMoneda(valor: number | string | null | undefined) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(valor ?? 0));
}

export function formatoFecha(valor: string | Date | null | undefined) {
  if (!valor) return "—";
  const fecha = typeof valor === "string" ? new Date(valor) : valor;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

export function formatoFechaCorta(valor: string | Date | null | undefined) {
  if (!valor) return "—";
  const fecha = typeof valor === "string" ? new Date(valor) : valor;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(fecha);
}

export function formatoFechaHora(valor: string | Date | null | undefined) {
  if (!valor) return "—";
  const fecha = typeof valor === "string" ? new Date(valor) : valor;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}

export function iniciales(nombre?: string | null, apellidos?: string | null) {
  const partes = [nombre, apellidos].filter(Boolean).join(" ").trim().split(/\s+/);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export function formatoTamano(bytes: number | null | undefined) {
  const valor = Number(bytes ?? 0);
  if (!Number.isFinite(valor) || valor <= 0) return "—";
  const unidades = ["B", "KB", "MB", "GB"];
  const indice = Math.min(Math.floor(Math.log(valor) / Math.log(1024)), unidades.length - 1);
  const cantidad = valor / 1024 ** indice;
  return `${cantidad.toFixed(indice === 0 ? 0 : 1)} ${unidades[indice]}`;
}

export function primerDiaDelMes(fecha = new Date()) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

export function aFechaISO(fecha: Date) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export function nombreMes(fecha: string | Date) {
  const valor = typeof fecha === "string" ? new Date(fecha) : fecha;
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(valor);
}

