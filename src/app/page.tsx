import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/auth";

export default async function Inicio() {
  const usuario = await obtenerUsuarioActual();
  redirect(usuario ? "/panel" : "/entrar");
}
