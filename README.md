# Checador de asistencia móvil

Aplicación en español para **Expo Go en Android**. Usa React Native, Expo SDK 57, TypeScript y Supabase. No incluye web, PWA, panel administrativo, Roku ni compilaciones nativas.

## Preparación

1. Instala Node.js y Expo Go en el celular Android. El proyecto usa SDK 57; si Expo Go muestra una incompatibilidad, instala la versión de Expo Go correspondiente a SDK 57 desde [expo.dev/go](https://expo.dev/go) para Android.
2. En esta carpeta ejecuta:

   ```bash
   npm ci
   ```

   La `.npmrc` del proyecto mantiene reproducible la resolución de dependencias opcionales de Expo Router con npm; `expo-doctor` comprueba las versiones nativas instaladas.

3. En este workspace `.env` ya contiene la URL y la clave publicable del proyecto conectado. Si copias el proyecto a otra computadora, crea allí `.env` a partir de `.env.example` y completa esos valores. La clave `service_role` o una clave secreta nunca debe estar aquí. `EXPO_PUBLIC_TIME_ZONE` acepta una zona IANA, por ejemplo `America/Hermosillo`. Las fechas quedan en UTC en PostgreSQL; solo la presentación usa esa zona.
4. Si usas un proyecto Supabase distinto del ya configurado, aplica en orden los archivos de `supabase/migrations/` desde el editor SQL o el MCP. Revisa antes que el proyecto no tenga recursos con los mismos nombres.

## Iniciar en Expo Go

```bash
npx expo start
```

Conecta computadora y Android a la misma red Wi-Fi, abre Expo Go y escanea el QR que aparece en la terminal. Si el celular no alcanza el servidor local, prueba `npx expo start --tunnel`; el túnel puede requerir instalar el paquete que solicite Expo. Si Expo Go pide inicio de sesión, entra en Expo CLI (`npx expo login`) y en Expo Go con la misma cuenta.

No necesitas `prebuild`, EAS, APK ni development build. `expo-camera`, `expo-local-authentication`, `expo-image-manipulator`, `expo-secure-store` y `expo-crypto` están incluidos en Expo Go para SDK 57. Las otras dependencias de ejecución son JavaScript o vienen con el SDK. Se instalaron las versiones compatibles con `npx expo install`.

## Correo y SMTP

En el proyecto conectado, **la confirmación de correo está activa**: el registro crea la cuenta y el perfil, pero el inicio de sesión se rechaza hasta confirmar el correo. Para probar con una dirección real, revisa el mensaje de verificación y luego vuelve manualmente a Expo Go para iniciar sesión. No se configuró un enlace profundo de confirmación para Expo Go.

En Supabase revisa **Authentication → Providers → Email** y **Authentication → SMTP Settings**. El MCP disponible no expone esos ajustes; no se verificó la entrega real de correo ni SMTP. Para una demostración académica inmediata puedes desactivar la confirmación de correo en ese proyecto desde el panel, o configurar SMTP y probar la recepción con una cuenta real. No guardes contraseñas fuera de Supabase Auth.

## Flujo y seguridad

Registro e inicio de sesión usan Supabase Auth. Un disparador crea `profiles` con el nombre indicado. La sesión se guarda en `expo-secure-store`. Cada movimiento pide al sistema Android una biometría configurada; se desactiva la alternativa de PIN. La cámara frontal se abre después de esa comprobación y solo permite una foto nueva dentro de la app. La foto se comprime a JPEG y se limita a 2 MB antes de subirla al bucket privado `attendance-photos`.

La aplicación conserva el `request_id` y la ruta en almacenamiento seguro después de confirmar la foto. Ante un fallo, el reintento pide biometría otra vez y consulta primero la RPC. Si la checada ya existe, recibe el mismo comprobante; si falta la foto, intenta subirla y vuelve a llamar a la RPC. Si el archivo temporal desapareció, pide tomar otra foto para la misma solicitud. Antes de confirmar la foto no hay subida ni registro.

`public.finalize_attendance` invoca una función privilegiada en `attendance_private`. Esta obtiene el usuario de la sesión, exige la foto exacta `<usuario>/<request_id>.jpg` y su propiedad, serializa las solicitudes por usuario, impide dos entradas seguidas o una salida sin entrada, y devuelve la fecha y hora asignadas por PostgreSQL. `attendance` permite SELECT propio, pero ningún INSERT directo del cliente. La combinación `(user_id, request_id)` es única. Storage permite crear y consultar solo fotos propias; no permite reemplazarlas ni borrarlas con la clave pública.

**Límite de confianza:** la biometría se comprueba localmente en el teléfono. Supabase no recibe una prueba criptográfica independiente de que se haya usado el sensor. La selfie es evidencia visual; esta aplicación no compara rostros ni detecta vida. La modalidad disponible depende del dispositivo Android y de Expo Go.

## Migraciones y limpieza de pruebas

Las migraciones aplicadas en el proyecto `kqabddlasmvipuskvnvr` son `20260924054226_attendance_initial.sql`, `20260924055128_private_rpc.sql` y `20260924060046_monotonic_server_time.sql`. El bucket es privado, acepta solo `image/jpeg` y limita cada archivo a 2 MiB. Las políticas y las funciones están en esos archivos; `supabase/tests/attendance_rules.sql` prueba reglas en una transacción que termina con `ROLLBACK`.

Una foto confirmada puede quedar sin registro si se corta la conexión, si el servidor rechaza el movimiento o si se abandona un reintento. Para localizar fotos de prueba huérfanas ejecuta esta consulta de **solo lectura** en Supabase:

```sql
select o.name, o.created_at
from storage.objects o
left join public.attendance a on a.photo_path = o.name
where o.bucket_id = 'attendance-photos'
  and a.id is null
  and o.created_at < now() - interval '1 day'
order by o.created_at;
```

Revisa las solicitudes pendientes de los celulares antes de borrar. Elimina solo los objetos de prueba seleccionados desde **Storage → attendance-photos** en el panel de Supabase; no borres directamente filas de `storage.objects`, porque eso no limpia necesariamente el archivo físico.

## Verificación realizada

- `npm run typecheck`, `npx expo lint`, `npx expo install --check`, `npx expo-doctor@latest` y un bundle JavaScript de Android con `npx expo export --platform android`.
- Mediante MCP: migraciones aplicadas; tablas y bucket inspeccionados; RLS, permisos y asesor de seguridad verificados. La prueba SQL transaccional pasó para movimientos válidos e inválidos, orden temporal, reintento duplicado, propiedad de foto y separación entre dos usuarios. Otra prueba con dos solicitudes simultáneas guardó una entrada y rechazó la segunda. Los metadatos temporales se eliminaron.
- Mediante la API pública: registro real de cuenta temporal, creación del perfil, rechazo de inicio de sesión sin confirmar correo, inicio de sesión tras confirmar esa cuenta de prueba, rechazo de INSERT directo (`42501`) y rechazo de subida fuera de la ruta permitida (`403`). La cuenta de prueba se eliminó.

No hubo acceso a un Android físico en este entorno. El bundle y las pruebas de backend no demuestran el funcionamiento del sensor ni de la cámara en tu teléfono.
No se pudo realizar una subida válida de Storage desde una cuenta de prueba adicional porque Auth respondió `email rate limit exceeded` al crearla. La subida real y la recepción del correo deben comprobarse en el celular con una cuenta propia.

## Pruebas en tu Android

1. Registra una cuenta con un correo que puedas confirmar, confirma el correo e inicia sesión. Comprueba que aparece tu nombre.
2. Con una huella o rostro compatible configurado en Android, registra **entrada**: biometría → selfie frontal → repetir o confirmar → comprobante y último movimiento.
3. Registra **salida** y confirma que cambia el último movimiento. Comprueba que la app bloquea dos entradas seguidas y una salida sin entrada.
4. Cancela la biometría, niega el permiso de cámara y cancela una foto sin confirmarla. Comprueba en Supabase que no se creó una checada.
5. Corta la red después de confirmar una foto y usa **Reintentar** al recuperarla. Comprueba que aparece un solo registro y que el comprobante usa la fecha del servidor. Repite tras cerrar y abrir Expo Go.
6. Inicia sesión con otra cuenta y comprueba que no ve el nombre, los movimientos ni las fotografías de la primera.

Fuentes de compatibilidad: [Expo Go y versiones de SDK](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/), [biometría](https://docs.expo.dev/versions/v57.0.0/sdk/local-authentication/), [cámara](https://docs.expo.dev/versions/v57.0.0/sdk/camera/), [manipulación de imagen](https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/), [funciones de Supabase](https://supabase.com/docs/guides/database/functions).
