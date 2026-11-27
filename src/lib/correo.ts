import { after } from "next/server";
import nodemailer from "nodemailer";
import { escaparHtml } from "@/lib/convocatoria";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { esCorreoInterno } from "@/lib/telefono";

/**
 * Envio por correo de los avisos pendientes. Los avisos los crean disparadores
 * en la base de datos (tabla notificaciones); aqui solo se mandan los que aun
 * no se han enviado.
 *
 * Funciona con el proveedor que este configurado en las variables de entorno:
 * - Resend: RESEND_API_KEY (necesita un dominio verificado en Resend).
 * - SMTP, por ejemplo Gmail: SMTP_USUARIO y SMTP_CONTRASENA (contrasena de
 *   aplicacion), y opcionalmente SMTP_SERVIDOR y SMTP_PUERTO.
 * CORREO_REMITENTE es la direccion que aparece como remitente. Sin ninguna
 * configuracion no se envia nada y los avisos se quedan solo en la app.
 */

/** Los avisos mas antiguos que esto no se envian: avisar tarde confunde. */
const ANTIGUEDAD_MAXIMA_MS = 3 * 24 * 60 * 60 * 1000;
const LOTE = 100;

type Mensaje = { para: string; asunto: string; html: string; texto: string };
type Proveedor = { nombre: string; enviar: (mensajes: Mensaje[]) => Promise<(string | null)[]> };

export function proveedorCorreo(): Proveedor | null {
  const remitente = process.env.CORREO_REMITENTE?.trim();

  const claveResend = process.env.RESEND_API_KEY?.trim();
  if (claveResend && remitente) {
    return {
      nombre: "Resend",
      async enviar(mensajes) {
        const respuesta = await fetch("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: { Authorization: `Bearer ${claveResend}`, "Content-Type": "application/json" },
          body: JSON.stringify(
            mensajes.map((m) => ({ from: remitente, to: [m.para], subject: m.asunto, html: m.html, text: m.texto })),
          ),
        });
        if (respuesta.ok) return mensajes.map(() => null);
        const detalle = (await respuesta.text()).slice(0, 300);
        return mensajes.map(() => `Resend ${respuesta.status}: ${detalle}`);
      },
    };
  }

  const usuario = process.env.SMTP_USUARIO?.trim();
  const contrasena = process.env.SMTP_CONTRASENA?.replace(/\s/g, "");
  if (usuario && contrasena) {
    const puerto = Number(process.env.SMTP_PUERTO ?? 465);
    const transporte = nodemailer.createTransport({
      host: process.env.SMTP_SERVIDOR?.trim() || "smtp.gmail.com",
      port: puerto,
      secure: puerto === 465,
      auth: { user: usuario, pass: contrasena },
    });
    const de = remitente || usuario;
    return {
      nombre: "SMTP",
      async enviar(mensajes) {
        const resultados: (string | null)[] = [];
        for (const m of mensajes) {
          try {
            await transporte.sendMail({ from: de, to: m.para, subject: m.asunto, html: m.html, text: m.texto });
            resultados.push(null);
          } catch (error) {
            resultados.push(`SMTP: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300));
          }
        }
        return resultados;
      },
    };
  }

  return null;
}

function enlaceAbsoluto(url: string | null) {
  const base = (process.env.NEXT_PUBLIC_URL_APP ?? "").replace(/\/$/, "");
  if (!url) return base || null;
  return /^https?:\/\//.test(url) ? url : base ? `${base}${url}` : null;
}

export function componerCorreo(aviso: {
  titulo: string;
  cuerpo: string | null;
  url: string | null;
  comunidad: string;
}): Omit<Mensaje, "para"> {
  const enlace = enlaceAbsoluto(aviso.url);
  const html = [
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#1f2933">`,
    `<p style="font-size:13px;color:#6b7280;margin:0 0 12px">Comunidad de Propietarios ${escaparHtml(aviso.comunidad)}</p>`,
    `<h1 style="font-size:19px;margin:0 0 8px">${escaparHtml(aviso.titulo)}</h1>`,
    aviso.cuerpo ? `<p style="font-size:15px;line-height:1.5;margin:0 0 16px">${escaparHtml(aviso.cuerpo)}</p>` : "",
    enlace
      ? `<p style="margin:0 0 24px"><a href="${escaparHtml(enlace)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:600">Abrir en Mi Comunidad</a></p>`
      : "",
    `<p style="font-size:12px;color:#9ca3af;margin:0">Recibes este correo porque eres vecino de la comunidad. Puedes dejar de recibir avisos por correo en Ajustes, dentro de la app.</p>`,
    `</div>`,
  ].join("");
  const texto = [
    `Comunidad de Propietarios ${aviso.comunidad}`,
    "",
    aviso.titulo,
    aviso.cuerpo ?? "",
    enlace ? `\nÁbrelo en Mi Comunidad: ${enlace}` : "",
    "\nPuedes dejar de recibir avisos por correo en Ajustes, dentro de la app.",
  ].join("\n");
  return { asunto: `${aviso.titulo} · ${aviso.comunidad}`, html, texto };
}

/**
 * Envia los avisos pendientes de una comunidad. Pensada para llamarse con
 * after() justo despues de la accion que los ha creado.
 */
export async function enviarAvisosPendientes(comunidadId: string) {
  const proveedor = proveedorCorreo();
  if (!proveedor) return { enviados: 0, omitidos: 0, errores: 0 };

  const admin = crearClienteAdmin();
  const { data: pendientes } = await admin
    .from("notificaciones")
    .select("id, titulo, cuerpo, url, creado_en, comunidades(nombre), perfiles(correo, avisos_correo)")
    .eq("comunidad_id", comunidadId)
    .is("correo_enviado_en", null)
    .is("correo_error", null)
    .order("creado_en")
    .limit(LOTE);
  if (!pendientes?.length) return { enviados: 0, omitidos: 0, errores: 0 };

  const ahora = Date.now();
  const omitidos: { id: string; motivo: string }[] = [];
  const aEnviar: { id: string; mensaje: Mensaje }[] = [];

  for (const aviso of pendientes) {
    const correo = aviso.perfiles?.correo?.trim();
    if (ahora - new Date(aviso.creado_en).getTime() > ANTIGUEDAD_MAXIMA_MS) {
      omitidos.push({ id: aviso.id, motivo: "omitido: antiguo" });
    } else if (!correo || esCorreoInterno(correo)) {
      omitidos.push({ id: aviso.id, motivo: "omitido: sin correo" });
    } else if (aviso.perfiles?.avisos_correo === false) {
      omitidos.push({ id: aviso.id, motivo: "omitido: no quiere correos" });
    } else {
      aEnviar.push({
        id: aviso.id,
        mensaje: {
          para: correo,
          ...componerCorreo({
            titulo: aviso.titulo,
            cuerpo: aviso.cuerpo,
            url: aviso.url,
            comunidad: aviso.comunidades?.nombre ?? "",
          }),
        },
      });
    }
  }

  const resultados = aEnviar.length ? await proveedor.enviar(aEnviar.map((a) => a.mensaje)) : [];
  const enviados = aEnviar.filter((_, i) => resultados[i] === null).map((a) => a.id);
  const fallidos = aEnviar
    .map((a, i) => ({ id: a.id, motivo: resultados[i] }))
    .filter((f): f is { id: string; motivo: string } => f.motivo !== null);

  if (enviados.length) {
    await admin.from("notificaciones").update({ correo_enviado_en: new Date().toISOString() }).in("id", enviados);
  }
  for (const { id, motivo } of [...omitidos, ...fallidos]) {
    await admin.from("notificaciones").update({ correo_error: motivo }).eq("id", id);
  }
  if (fallidos.length) console.error(`[avisos] ${fallidos.length} correos fallaron con ${proveedor.nombre}:`, fallidos[0].motivo);

  return { enviados: enviados.length, omitidos: omitidos.length, errores: fallidos.length };
}

/** Programa el envio de los avisos para cuando la respuesta ya ha salido. */
export function enviarAvisosDespues(comunidadId: string) {
  if (!proveedorCorreo()) return;
  after(async () => {
    try {
      await enviarAvisosPendientes(comunidadId);
    } catch (error) {
      console.error("[avisos] No se pudieron enviar los correos:", error);
    }
  });
}
