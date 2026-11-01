# Mi Comunidad

Aplicación web para gestionar una comunidad de vecinos: personas, fincas, cuotas, juntas, incidencias, documentos y tablón de anuncios. Pensada para usarse desde el móvil y el ordenador, con una interfaz sencilla y accesible.

No es un producto comercial: es una herramienta privada para una comunidad concreta.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS 4
- **Supabase**: Postgres, autenticación, RLS y almacenamiento (región UE)
- **Vercel**: despliegue (plan gratuito, dominio `*.vercel.app`)
- **GitHub Actions**: integración continua y keep-alive de Supabase

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # rellena las claves
npm run dev
```

Abre http://localhost:3000.

### Variables de entorno

| Variable | Descripción |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (publishable/anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta. **Solo servidor** |
| `NEXT_PUBLIC_URL_APP` | URL pública de la app |

La clave `service_role` nunca debe exponerse en el navegador ni subirse al repositorio.

## Base de datos

Las migraciones están en `supabase/migrations` y se aplican con:

```bash
supabase link --project-ref <ref>
supabase db push
```

Los tipos de TypeScript se regeneran con:

```bash
supabase gen types typescript --linked --schema public > src/lib/tipos-bd.ts
```

### Convención de nombres

- Tablas en **plural**, columnas en **singular**, `snake_case`, español y **sin tildes ni ñ**.
- Dinero con `numeric(12,2)`; coeficientes con `numeric(8,4)`.
- Fechas: `fecha_*` para `date`, `*_en` para `timestamptz`.
- Booleanos: `es_*`, `esta_*`, `tiene_*`.
- Enums en minúsculas: `pendiente`, `pagado`, `abierta`…
- En código: dominio en español (`obtenerVecinos`, `crearIncidencia`, `importeTotal`). Las APIs de los frameworks se quedan en inglés (`useState`, `page.tsx`).

## Estructura

```
src/
  app/
    (auth)/entrar/          acceso
    (app)/                  zona privada
      panel/  vecinos/  tablon/  incidencias/
      finanzas/  juntas/  documentos/  ajustes/
    acciones/               Server Actions (español)
  components/
    estructura/             barra lateral, navegación móvil
    ui/                     componentes reutilizables
  lib/
    supabase/               clientes servidor, navegador y admin
    auth.ts  permisos.ts  utilidades.ts
    tipos-bd.ts             tipos generados
  proxy.ts                  refresco de sesión y rutas privadas
supabase/
  migrations/               esquema y datos iniciales
```

## Roles

`presidente`, `vicepresidente`, `secretario`, `vocal`, `propietario`, `inquilino`, `administrador_fincas`.

La autorización real vive en la base de datos (RLS), no solo en la interfaz. Un vecino nunca puede leer los recibos de otro.

## Despliegue

1. Subir el repositorio a GitHub.
2. Importar el proyecto en Vercel.
3. Configurar las variables de entorno de producción.
4. Desplegar.

No hace falta dominio propio: `https://<proyecto>.vercel.app` es suficiente y gratuito.

## Fases

- [x] Fase 0: cimientos, autenticación, RLS, estructura responsive
- [x] Fase 1: vecinos, tablón, incidencias, juntas, documentos, panel
- [x] Fase 2 (parcial): finanzas (gastos y recibos en consulta)
- [ ] Fase 2 completa: presupuestos, generación de cuotas, conciliación
- [ ] Fase 3: actas en PDF, asistencia y votaciones
- [ ] Fase 4: reservas, mantenimiento preventivo, notificaciones push
- [ ] Fase 5: multcomunidad, exportaciones, Telegram

## Aviso legal

La aplicación facilita la gestión, pero **no sustituye** el libro de actas, las notificaciones fehacientes ni los acuerdos formalizados conforme a la Ley de Propiedad Horizontal. Los datos personales se tratan conforme al RGPD y se alojan en la UE.
