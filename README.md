# Checador de asistencia · Android

Aplicación móvil con React Native, Expo SDK 57, TypeScript y Supabase para registrar entradas y salidas mediante biometría y una selfie.

La [web de supervisión](https://github.com/Lok-yo/checador-asistencia-web) permite consultar los registros del mismo proyecto Supabase.

## Requisitos

- Node.js 22, versión 22.13 o superior, npm y Git.
- Android con cámara frontal y biometría configurada.
- Expo Go compatible con SDK 57: [descargar para Android](https://expo.dev/go).
- Un proyecto Supabase con las migraciones aplicadas.

## Instalación

```bash
git clone https://github.com/Lok-yo/checador-asistencia.git
cd checador-asistencia
npm ci
cp .env.example .env
```

En Windows usa `copy .env.example .env`.

Completa `.env` con la URL y clave publicable de Supabase, disponibles en el panel del proyecto:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
EXPO_PUBLIC_TIME_ZONE=America/Hermosillo
```

No uses claves `service_role` ni `sb_secret_...`. Reinicia Expo si cambias estas variables. Las fechas se guardan en UTC y se muestran según la zona configurada.

## Ejecutar en Expo Go

```bash
npx expo start
```

Conecta la computadora y el celular a la misma Wi-Fi. Abre Expo Go en Android y escanea el QR de la terminal.

Si la red bloquea la conexión, prueba `npx expo start --tunnel`. El proyecto utiliza módulos compatibles con Expo Go; no requiere APK ni compilaciones nativas. Para instalar dependencias de Expo usa `npx expo install <paquete>`.

## Uso

1. Registra una cuenta e inicia sesión.
2. Selecciona **Registrar entrada** o **Registrar salida**.
3. Completa la comprobación biométrica de Android.
4. Toma una selfie con la cámara frontal; puedes repetirla o confirmarla.
5. Espera el comprobante del servidor. El inicio mostrará el último movimiento.

La biometría se solicita en cada movimiento y reintento; no se acepta un PIN como alternativa. Sin biometría disponible o configurada no se puede continuar. Cancelar la comprobación, rechazar la cámara o no confirmar la foto no guarda una checada. No se permite seleccionar fotos de la galería.

Los reintentos conservan el mismo identificador de solicitud: si el servidor ya guardó el registro, devuelve su comprobante sin duplicarlo.

## Supabase

En un proyecto nuevo, ejecuta los archivos de [supabase/migrations/](supabase/migrations/) en SQL Editor, en orden por nombre. Si las migraciones ya están aplicadas, no las vuelvas a ejecutar.

La web utiliza el mismo proyecto: sus migraciones se aplican **después** de las móviles. Configura la URL y clave pública correspondientes en cada aplicación.

En **Authentication → Providers → Email**, elige si las cuentas deben confirmar su correo. Si activas la confirmación, configura SMTP y confirma la cuenta antes de iniciar sesión.

- Supabase Auth administra las cuentas y contraseñas; la sesión móvil se conserva en almacenamiento seguro.
- `profiles` guarda los nombres y `attendance` los movimientos.
- Las fotos JPEG de hasta **2 MiB** se guardan por usuario y solicitud en el bucket privado `attendance-photos`.
- RLS limita el acceso a datos propios; los supervisores autorizados tienen acceso de lectura global.
- La RPC `finalize_attendance` valida la propiedad de la foto, asigna la hora del servidor y controla solicitudes simultáneas y duplicadas.
- No se permiten inserciones directas, dos entradas consecutivas ni una salida sin entrada previa.

**Biometría:** la comprobación es local; Supabase no recibe una prueba criptográfica independiente del sensor. La modalidad depende de Android y del dispositivo. La selfie es evidencia visual, sin comparación facial ni detección de vida.

Para limpiar fotos de prueba sin registro, comprueba que su ruta no aparezca en `attendance.photo_path` y que no exista una solicitud pendiente. Elimina únicamente esas fotos desde el panel de Storage; no borres filas directamente de `storage.objects`.

## Comandos

```bash
npm run typecheck
npm run lint
npx expo install --check
```

Las pruebas SQL de las reglas están en [supabase/tests/attendance_rules.sql](supabase/tests/attendance_rules.sql).
