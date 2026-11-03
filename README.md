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
      finanzas/  juntas/  documentos/  ajustes/  plataforma/
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

## Rendimiento

Todas las páginas son dinámicas (leen la sesión), así que cada navegación llega
al servidor. Para que el cambio de módulo sea rápido:

- **Funciones en `cdg1` (París)**, la misma región que Supabase (`eu-west-3`).
  Se configura en `vercel.json`. Si no, cada consulta cruza el Atlántico.
- **`getClaims()` en vez de `getUser()`**: la firma del JWT se verifica en local
  con las claves públicas del proyecto, sin llamar al servidor de Auth.
- **Una sola consulta por navegación** para perfil, membresía y comunidad
  (`select("*, comunidades(*), perfiles(*)")`). Si la persona pertenece a varias
  comunidades, la cookie `comunidad_activa` elige cuál se muestra.
- **`staleTimes.dynamic: 30`**: el contenido visitado se reutiliza 30 segundos.
  Las acciones de servidor llaman a `revalidatePath`, así que los cambios se ven
  al instante.
- **`loading.tsx`** con un esqueleto: la pantalla responde al clic de inmediato.

Para medir: `node --env-file=.env.local scripts/probar-render.mjs <url>`
(credenciales en `COMUNIDAD_CORREO`/`COMUNIDAD_CONTRASENA` o en
`.secretos/credenciales-presidente.txt`).

## Roles

Los permisos ya no están fijados en el código: viven en la tabla `roles` y se
pueden editar desde **`/plataforma`**. Cada rol guarda cinco permisos:

| Permiso | Qué permite |
| --- | --- |
| `administra_comunidad` | Editar datos de la comunidad, fincas, tablón, juntas y gastos |
| `gestiona_vecinos` | Dar de alta, editar y eliminar vecinos y titulares |
| `gestiona_documentos` | Subir y borrar documentos |
| `gestiona_incidencias` | Cambiar el estado de las incidencias y dejar seguimiento |
| `ver_finanzas` | Consultar gastos, recibos y presupuestos |

Roles que se pueden asignar desde la aplicación:

- `presidente`: todos los permisos.
- `vicepresidente`: todos los permisos.
- `vocal`: documentos, incidencias y finanzas.
- `vecino`: solo consulta.

El rol `administrador_plataforma` no se puede editar (siempre tiene todos los
permisos). Los roles **no se crean ni se borran**: solo se cambia su nombre,
descripción y permisos.

El enum conserva `secretario`, `propietario`, `inquilino` y `administrador_fincas`
por compatibilidad con datos antiguos; si no tienen fila en `roles` usan unos
permisos por defecto. Los antiguos `propietario` e `inquilino` se migraron a
`vecino`.

La autorización real vive en la base de datos (RLS), no solo en la interfaz. Las
funciones `es_administrador`, `puede_gestionar_vecinos`,
`puede_gestionar_documentos` y `puede_gestionar_incidencias` leen la tabla
`roles`. Un vecino nunca puede leer los recibos de otro.

### Administrador de la plataforma

`perfiles.es_admin_plataforma` da acceso total a todas las comunidades y a
`/plataforma`, donde se crean comunidades, se edita la tabla de roles y se
gestionan los vecinos de la comunidad activa. Se comprueba en la base de datos
con `es_admin_plataforma()` y políticas RLS permisivas.

Este acceso se puede conceder desde la propia interfaz al editar un vecino, pero
no se puede retirar a sí mismo el administrador de la plataforma.

### Vecinos desde `/plataforma`

La tabla de vecinos muestra solo los de la **comunidad activa** y permite:

- **Crear**: reutiliza el alta por teléfono (con correo opcional y segundo titular).
- **Editar**: nombre, apellidos, teléfono, correo, rol y vivienda. Al cambiar la
  vivienda, la titularidad se mueve y los coeficientes se reparten de nuevo.
- **Eliminar**: borra su pertenencia a la comunidad y sus titulares. Si la
  persona no tiene más comunidades ni viviendas, se elimina también su cuenta.


## Incidencias

Cualquier miembro puede registrar una incidencia. Solo quien tenga el permiso
`gestiona_incidencias` (por defecto, presidente, vicepresidente y vocal) puede
cambiar su estado (abierta, en curso, resuelta o cerrada). Al resolverla o
cerrarla se abre un cuadro para dejar un comentario opcional con lo que se ha
hecho.

Cada cambio de estado queda registrado en `seguimientos_incidencia`, con su
autor y la fecha, y se muestra en la tarjeta como **Seguimiento**, visible para
todos los vecinos. Los permisos se comprueban en la acción del servidor y en las
políticas RLS con `puede_gestionar_incidencias`, no solo en la interfaz.

## Documentos

Los documentos se dividen en cinco categorías fijas: **Estatutos, Actas,
Contratos, Certificados y Presupuestos**. Solo se admiten PDF (máximo 25 MB) y
solo pueden subirlos el administrador de la plataforma y quien tenga el permiso
`gestiona_documentos` (por defecto, presidente, vicepresidente y vocal). El resto
de vecinos puede consultarlos y descargarlos.

Los archivos se guardan en un bucket privado de Supabase Storage (`documentos`).
Los permisos se comprueban en la acción del servidor, en la política RLS de
`documentos` y en las políticas de Storage con la función
`puede_gestionar_documentos`, no solo en la interfaz.

## Casas, pisos y titulares

Cada comunidad guarda `numero_casas` y `numero_pisos`. La función SQL
`configurar_fincas(comunidad, casas, pisos)` crea las fincas que faltan
(`Casa 1`, `1ºA`, `1ºB`, `1ºC`, `1ºD`, `2ºA`…), elimina las que ya no se piden **solo si no
tienen titulares** y reparte el coeficiente a partes iguales hasta sumar 100 %.
Los pisos se numeran por planta y puerta: cuatro puertas (A, B, C y D) por planta.
El número de pisos es el total de viviendas: 12 pisos son 3 plantas × 4 puertas.

Al dar de alta un vecino se elige su casa o piso y, opcionalmente, un segundo
titular: con correo se le crea su cuenta (o se reutiliza la que ya tenía); solo
con nombre queda registrado como titular sin acceso. Los dos titulares comparten
la finca al 50 %.

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
