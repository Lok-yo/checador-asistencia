# Checador de asistencia · App Android

Aplicación académica en español para registrar entradas y salidas con **biometría del teléfono, una selfie nueva y confirmación del servidor**. Está desarrollada con React Native, Expo SDK 57, TypeScript y Supabase y se ejecuta mediante **Expo Go en Android**.

El sistema tiene dos repositorios que comparten el mismo backend:

| Repositorio | Responsabilidad |
|---|---|
| **[checador-asistencia](https://github.com/Lok-yo/checador-asistencia)** · este proyecto | Registro de cuentas, inicio de sesión y checadas desde Android. |
| [checador-asistencia-web](https://github.com/Lok-yo/checador-asistencia-web) | Consulta de registros y fotografías para cuentas autorizadas como supervisor. |

## Inicio rápido

### Requisitos

- Git y npm; para Node.js, usa **22.13 o posterior dentro de la rama 22**, o **24.3 o posterior dentro de la rama 24**. Son versiones compatibles con el SDK y las dependencias instaladas.
- Un Android con cámara frontal y biometría compatible **configurada en los ajustes del teléfono**.
- Expo Go compatible con **SDK 57**. Si aparece una incompatibilidad, consulta la [versión de Expo Go para Android](https://expo.dev/go).
- Acceso al proyecto de Supabase y a su URL y clave publicable. El backend de esta entrega ya está configurado; para otro proyecto, sigue [Configuración de Supabase](#configuración-de-supabase).

### Instalar y configurar

```bash
git clone https://github.com/Lok-yo/checador-asistencia.git
cd checador-asistencia
npm ci
cp .env.example .env
```

El repositorio es privado: GitHub te pedirá una cuenta con acceso. En Windows, sustituye el último comando por `copy .env.example .env`.

Edita `.env` con la configuración del proyecto. Los valores de esta tabla son **ejemplos**, no credenciales utilizables:

| Variable | Ejemplo | Para qué sirve |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://your-project-ref.supabase.co` | URL del backend compartido con la web. |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_your_key` | Clave pública del mismo proyecto. |
| `EXPO_PUBLIC_TIME_ZONE` | `America/Hermosillo` | Zona IANA para mostrar fechas y horas. |

Obtén la URL y la clave publicable desde **Connect** en el panel de Supabase; las claves también se administran en **Settings → API Keys**. Las variables `EXPO_PUBLIC_*` forman parte del cliente: **nunca coloques una clave `service_role`, `sb_secret_...` ni un secreto administrativo**. `.env` está excluido de Git; [.env.example](.env.example) se versiona sin secretos.

Mantén la misma zona horaria en la app y en `VITE_TIME_ZONE` de la web. PostgreSQL guarda los instantes en UTC; la zona configurada solo cambia su presentación. Reinicia Expo después de editar `.env`.

### Abrir en Expo Go

```bash
npx expo start
```

1. Conecta la computadora y el Android a la misma red Wi-Fi.
2. Abre Expo Go en el teléfono y escanea el QR de la terminal.
3. Registra una cuenta o inicia sesión. El inicio debe mostrar tu nombre y tu último movimiento.

Si la red impide conectar ambos equipos, prueba `npx expo start --tunnel` y acepta la instalación del paquete de túnel si Expo lo solicita. Si Expo Go pide autenticación, usa la misma cuenta de Expo en el teléfono y en `npx expo login`.

### Compatibilidad con Expo Go

Los módulos de cámara, biometría, compresión, almacenamiento seguro y UUID usados en el proyecto están disponibles en Expo Go para SDK 57: `expo-camera`, `expo-local-authentication`, `expo-image-manipulator`, `expo-secure-store` y `expo-crypto`.

Las versiones de Expo se instalaron con `npx expo install`. Conserva [package-lock.json](package-lock.json) y [.npmrc](.npmrc), que contiene `legacy-peer-deps=true`, para reproducir la instalación. Al agregar o actualizar una biblioteca de Expo, utiliza `npx expo install <paquete>` y comprueba su compatibilidad con Expo Go.

La configuración de [app.json](app.json) habilita únicamente Android. Para esta entrega se usa Expo Go; no hace falta generar APK, ejecutar `prebuild`, crear proyectos nativos, development builds ni configurar EAS Build.

## Cómo se registra una checada

**Registro → inicio de sesión → entrada o salida → biometría → selfie → Supabase → comprobante.**

1. El usuario elige **Registrar entrada** o **Registrar salida**.
2. La app verifica que Android tenga un sensor compatible y biometría configurada. El sistema solicita la comprobación; un PIN no se acepta como alternativa.
3. Solo tras una comprobación correcta se abre la cámara frontal. No hay selección desde la galería.
4. El usuario toma una foto nueva y puede **repetirla, confirmarla o cancelar**.
5. Al confirmarla, la app prepara un JPEG de hasta **2 MiB** y lo sube a `attendance-photos/<user_id>/<request_id>.jpg`.
6. La RPC `finalize_attendance` valida el movimiento y devuelve el registro confirmado con su fecha y hora oficiales.
7. La app muestra el comprobante y actualiza el último movimiento.

Cancelar la biometría, rechazar el permiso de cámara o salir sin confirmar una foto no guarda una checada. Abandonar el proceso invalida la comprobación local; cada movimiento y cada reintento vuelve a pedir biometría. Los botones se bloquean durante las operaciones.

### Fallos y reintentos

La subida de la foto y la creación del registro son pasos separados. Al confirmar una foto se conserva una solicitud pendiente por usuario en `expo-secure-store`, con el mismo `request_id`, ruta y referencia a la foto local.

| Situación | Comportamiento |
|---|---|
| Se pierde la conexión o falla la subida | Se muestra un error y se ofrece reintentar la solicitud pendiente. |
| El servidor guardó la checada, pero su respuesta no llegó | El reintento recibe el comprobante existente; no crea otro registro. |
| La foto está subida y falta el registro | El reintento vuelve a solicitar la validación del servidor. |
| Desapareció la foto temporal antes de subirla | Se pide tomar otra foto conservando el identificador de la solicitud. |
| La sesión venció | Vuelve a iniciar sesión; si hay una solicitud pendiente, se recupera con la misma cuenta. |
| El movimiento incumple las reglas | Se muestra el motivo y se termina esa solicitud; puede quedar una foto sin registro. |

El reintento consulta primero la RPC; solo intenta subir la foto cuando el servidor indica que falta. **El éxito se muestra después de recibir la confirmación del servidor**, nunca por el simple hecho de haber subido la imagen.

## Configuración de Supabase

### Usar el backend existente

El proyecto de esta entrega es **`kqabddlasmvipuskvnvr`**. Sus migraciones móviles y las ampliaciones de la web ya se aplicaron mediante el MCP de Supabase. Para conectarte, configura `.env` con ese proyecto; **no vuelvas a ejecutar las migraciones iniciales**.

La confirmación de correo fue desactivada por el propietario para la demostración, según su comprobación en el teléfono. Ese ajuste se administra en el panel de Supabase y no queda definido por estas migraciones.

### Reproducir el backend en un proyecto nuevo

Revisa primero que el proyecto de destino sea el correcto y que no tenga recursos con los mismos nombres. Aplica estos archivos **en orden**, mediante `apply_migration` del MCP de Supabase o ejecutando su contenido en SQL Editor con permisos administrativos:

| Orden | Migración | Resultado |
|---|---|---|
| 1 | [20260924054226_attendance_initial.sql](supabase/migrations/20260924054226_attendance_initial.sql) | Tablas, perfil automático, restricciones, índices, RLS, bucket privado y RPC inicial. |
| 2 | [20260924055128_private_rpc.sql](supabase/migrations/20260924055128_private_rpc.sql) | Mueve la lógica privilegiada a `attendance_private` y deja una RPC pública sin privilegios elevados. |
| 3 | [20260924060046_monotonic_server_time.sql](supabase/migrations/20260924060046_monotonic_server_time.sql) | Asigna el tiempo del servidor tras el bloqueo y conserva el orden de movimientos simultáneos. |

Para habilitar también la supervisión, continúa con las **tres migraciones del [repositorio web](https://github.com/Lok-yo/checador-asistencia-web#configuración-de-supabase)**, después de estas tres. No crees otro backend para la web.

Ambos repositorios contienen partes de una misma historia de base de datos. Mantén el registro de lo aplicado: el MCP `apply_migration` escribe en el historial de migraciones; ejecutar SQL manualmente en SQL Editor no lo hace. Esta entrega no incluye una configuración local de Supabase CLI ni un flujo de `db push` independiente por repositorio.

### Cuentas, confirmación de correo y SMTP

Las contraseñas pertenecen exclusivamente a **Supabase Auth**. No existe una tabla propia de contraseñas. El registro crea la cuenta con `full_name` y un disparador genera su fila de `profiles`.

En Supabase revisa **Authentication → Providers → Email** y la configuración de SMTP:

- Con confirmación de correo desactivada, una cuenta registrada puede iniciar sesión directamente.
- Con confirmación activada, el usuario debe confirmar el correo antes de iniciar sesión. Luego debe volver manualmente a Expo Go: no se implementó un enlace profundo de confirmación.
- Si necesitas envío de correo, configura SMTP y prueba la recepción con una cuenta real. El MCP utilizado no expuso esos ajustes y no se verificó la entrega de correo.

### Datos y permisos

| Recurso | Contenido o regla |
|---|---|
| `auth.users` | Cuentas gestionadas por Supabase Auth. |
| `profiles` | `id`, `full_name` y `created_at`; relacionado con `auth.users`. |
| `attendance` | `id`, `user_id`, `type`, `photo_path`, `created_at` y `request_id`. |
| `attendance-photos` | Bucket privado; solo JPEG de hasta 2 MiB, organizado por usuario y solicitud. |
| `finalize_attendance` | Única vía del cliente para finalizar una checada. |

La sesión móvil se conserva en `expo-secure-store`. RLS limita la consulta a los datos y fotos propios; las cuentas autorizadas como supervisor mediante las migraciones web tienen lectura global del checador. Ningún cliente puede insertar directamente en `attendance` ni reemplazar o borrar evidencia con la clave pública.

La RPC obtiene el usuario de la sesión, comprueba la ruta exacta y la propiedad de la foto para un registro nuevo, y rechaza **dos entradas consecutivas** o **una salida sin entrada previa**. Un bloqueo por usuario controla llamadas simultáneas; la restricción única `(user_id, request_id)` evita duplicados y permite recuperar el comprobante existente. La fecha y hora se asignan en PostgreSQL.

**Límite de confianza:** Android realiza la comprobación biométrica localmente; Supabase no recibe una prueba criptográfica independiente del uso del sensor. La modalidad disponible depende del teléfono y de Expo Go; no se promete reconocimiento facial en todos los dispositivos. La selfie es evidencia visual: no hay comparación facial ni detección de vida.

### Limpiar fotos de prueba sin registro

Una interrupción después de subir la imagen puede dejar un objeto sin checada. Esta consulta de **solo lectura** localiza candidatos con más de un día de antigüedad:

```sql
select o.name, o.created_at
from storage.objects o
left join public.attendance a on a.photo_path = o.name
where o.bucket_id = 'attendance-photos'
  and a.id is null
  and o.created_at < now() - interval '1 day'
order by o.created_at;
```

Antes de borrar, revisa las solicitudes pendientes en los teléfonos. Elimina únicamente las fotos de prueba seleccionadas desde **Storage → attendance-photos** en el panel. No borres directamente filas de `storage.objects`: eso no garantiza eliminar el archivo físico.

## Estructura y comandos

| Ruta | Responsabilidad |
|---|---|
| [src/app/](src/app/) | Pantallas de registro, inicio de sesión, checador, cámara y resultado. |
| [src/state/auth.tsx](src/state/auth.tsx) | Sesión, perfil y último movimiento. |
| [src/state/attendance.tsx](src/state/attendance.tsx) | Biometría, solicitud pendiente, subida y finalización. |
| [src/lib/](src/lib/) | Cliente Supabase, biometría, compresión, fechas y almacenamiento de pendientes. |
| [src/components/ui.tsx](src/components/ui.tsx) | Componentes visuales compartidos. |
| [supabase/migrations/](supabase/migrations/) | Definición reproducible del backend móvil. |
| [supabase/tests/attendance_rules.sql](supabase/tests/attendance_rules.sql) | Pruebas SQL de reglas y permisos; termina con `ROLLBACK`. |

`supabase/` **debe conservarse en Git**: contiene el SQL del proyecto, no una copia de la base de datos, cuentas, fotos o credenciales. Permite revisar y reproducir las reglas que exige la app.

| Comando | Uso |
|---|---|
| `npm ci` | Instalar las versiones del archivo de bloqueo. |
| `npx expo start` | Iniciar Metro y obtener el QR para Expo Go. |
| `npm run typecheck` | Comprobar TypeScript. |
| `npm run lint` | Revisar el código con ESLint de Expo. |
| `npx expo install --check` | Revisar versiones de dependencias de Expo. |
| `npx expo-doctor@latest` | Diagnosticar la configuración y compatibilidad del proyecto. |
| `npx expo export --platform android` | Generar el bundle JavaScript de Android; no genera un APK. |

## Diagnóstico rápido

| Problema | Qué revisar |
|---|---|
| Expo Go indica que el SDK no es compatible | Usa una versión compatible con SDK 57; consulta [expo.dev/go](https://expo.dev/go). |
| El teléfono no abre el QR | Misma Wi-Fi, permisos de red y ausencia de aislamiento entre dispositivos; prueba el túnel. |
| Faltan variables o no conecta a Supabase | Completa `.env`, usa URL y clave del mismo proyecto y reinicia Expo. |
| El correo no está confirmado | Confirma la cuenta o revisa la configuración de confirmación y SMTP del proyecto. |
| No hay biometría disponible | Configura una modalidad compatible en Android; el PIN no permite continuar. |
| El permiso de cámara fue rechazado definitivamente | Activa el permiso de cámara para **Expo Go** en los ajustes de Android y reinicia el proceso. |
| Hay una checada pendiente | Recupera la red y usa **Reintentar** con la misma cuenta; no crees otra solicitud. |

## Verificación y demostración

**Resultados registrados hasta el 29 de septiembre de 2026.** Las comprobaciones de herramientas y la experiencia en un teléfono son evidencias distintas:

| Comprobación | Resultado registrado |
|---|---|
| Herramientas locales | TypeScript, lint, compatibilidad de dependencias, Expo Doctor y bundle JavaScript de Android completados. |
| MCP y PostgreSQL | Migraciones, tablas, bucket, RLS y permisos revisados; pruebas de movimientos válidos e inválidos, orden temporal, duplicados, propiedad de foto y separación de usuarios superadas. Dos solicitudes simultáneas produjeron una entrada y rechazaron la segunda. |
| API real de Supabase | Registro y perfil de una cuenta temporal, autenticación según confirmación de correo y rechazo de inserción directa y subida fuera de la ruta autorizada comprobados. La cuenta de prueba se eliminó. |
| Teléfono del propietario | El usuario confirmó que la app funciona en Android y que la imagen se guardó en Supabase. |

El entorno de desarrollo no tuvo acceso a los sensores de un Android físico. Sigue pendiente probar cada cancelación, recuperación y dispositivo; la entrega real de correo y SMTP tampoco se verificó.

### Lista para la demostración en Android

- [ ] Registrar una cuenta e iniciar sesión; comprobar el nombre y la conservación de la sesión al reabrir Expo Go.
- [ ] Registrar entrada y salida: biometría → cámara frontal → repetir/confirmar → comprobante y último movimiento.
- [ ] Comprobar que no se permite otra entrada sin salida ni una salida sin entrada.
- [ ] Cancelar biometría y foto, y rechazar el permiso de cámara; comprobar que no se creó ninguna checada.
- [ ] Interrumpir la red después de confirmar, reabrir Expo Go y reintentar; comprobar un solo registro y el mismo comprobante si ya se había guardado.
- [ ] Entrar con otra cuenta sin permiso de supervisor y comprobar la separación de datos.

## Referencias

- [Expo SDK 57 y requisitos](https://docs.expo.dev/versions/v57.0.0/), [versiones de Expo Go](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/).
- [Biometría](https://docs.expo.dev/versions/v57.0.0/sdk/local-authentication/), [cámara](https://docs.expo.dev/versions/v57.0.0/sdk/camera/), [compresión de imágenes](https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/).
- [Funciones de Supabase](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [migraciones](https://supabase.com/docs/guides/deployment/database-migrations), [claves API](https://supabase.com/docs/guides/getting-started/api-keys), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
