import Link from "next/link";
import { Download, ShieldCheck } from "lucide-react";
import { requerirContexto } from "@/lib/auth";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { CabeceraPagina } from "@/components/ui/CabeceraPagina";

export const metadata = { title: "Privacidad" };

/**
 * Informacion de privacidad para los vecinos (art. 13 RGPD). La responsable
 * del tratamiento es la propia comunidad de propietarios.
 */
export default async function PaginaPrivacidad() {
  const { comunidad } = await requerirContexto();
  const supabase = await crearClienteServidor();
  const { data: cargos } = await supabase
    .from("miembros")
    .select("rol, perfiles(nombre, apellidos)")
    .eq("comunidad_id", comunidad.id)
    .eq("estado", "activo")
    .in("rol", ["presidente", "secretario", "administrador_fincas"]);

  const contacto = (cargos ?? [])
    .map((c) => {
      const nombre = [c.perfiles?.nombre, c.perfiles?.apellidos].filter(Boolean).join(" ");
      const cargo = c.rol === "administrador_fincas" ? "administrador de fincas" : c.rol;
      return nombre ? `${nombre} (${cargo})` : null;
    })
    .filter(Boolean)
    .join(", ");
  const direccion = [comunidad.direccion, [comunidad.codigo_postal, comunidad.ciudad].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-3xl">
      <CabeceraPagina
        titulo="Privacidad"
        icono={ShieldCheck}
        descripcion="Cómo trata la comunidad tus datos personales"
      />

      <article className="tarjeta space-y-5 text-[15px] leading-relaxed">
        <section>
          <h2 className="font-semibold">Quién es responsable</h2>
          <p className="mt-1 text-suave">
            La Comunidad de Propietarios {comunidad.nombre}
            {comunidad.cif ? `, con CIF ${comunidad.cif}` : ""}
            {direccion ? `, ${direccion}` : ""}. Puedes dirigirte a la junta
            {contacto ? `: ${contacto}` : ""}.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Qué datos se tratan</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-suave">
            <li>Nombre, teléfono, correo y domicilio para notificaciones.</li>
            <li>Vivienda, titularidad y cuota de participación.</li>
            <li>Recibos, pagos y deudas con la comunidad.</li>
            <li>Asistencia, representación y voto en las juntas.</li>
            <li>Incidencias que comunicas, con sus fotos.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">Para qué y con qué base</h2>
          <p className="mt-1 text-suave">
            Para gestionar la comunidad: cobrar las cuotas, convocar y celebrar las juntas,
            redactar y notificar las actas, atender las incidencias y avisarte de lo que te
            afecta. Es una obligación que impone la Ley de Propiedad Horizontal a la comunidad
            y a sus propietarios (art. 6.1.c RGPD). No se usan para publicidad ni se ceden a
            terceros salvo obligación legal, a los proveedores que tengan que atender una
            incidencia o al juzgado en una reclamación de deuda.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Quién los ve</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-suave">
            <li>
              Los vecinos ven el nombre, la vivienda y el teléfono y correo de contacto de los
              demás en el directorio de la comunidad.
            </li>
            <li>
              Los recibos y pagos de cada vivienda solo los ven sus titulares y la junta.
            </li>
            <li>
              Si una vivienda no está al corriente, aparece en la convocatoria de la junta,
              sin importes, porque la ley lo exige para saber quién no puede votar (art. 15.2
              y 16.2 LPH). El importe solo lo ve la junta.
            </li>
            <li>
              La aplicación se aloja en servidores de la Unión Europea, que actúan como
              encargados del tratamiento.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">Cuánto tiempo se guardan</h2>
          <p className="mt-1 text-suave">
            Mientras seas propietario o residente. Al irte se borran tus datos de contacto y
            tu cuenta. Se conservan las actas, que forman parte del libro de actas, y los
            recibos y pagos durante el plazo en que se pueden reclamar.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Tus derechos</h2>
          <p className="mt-1 text-suave">
            Puedes pedir a la junta ver tus datos, corregirlos, borrarlos cuando ya no hagan
            falta, oponerte o limitar su uso. Si no te atienden, puedes reclamar ante la
            Agencia Española de Protección de Datos (aepd.es).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="/ajustes/mis-datos" className="boton boton-borde" download>
              <Download className="size-4" aria-hidden />
              Descargar mis datos
            </a>
            <Link href="/ajustes#contacto" className="boton boton-borde">
              Corregir mis datos de contacto
            </Link>
          </div>
        </section>
      </article>
    </div>
  );
}
