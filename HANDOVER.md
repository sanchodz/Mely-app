# FINDY — Documento de traspaso (handover)

Estado auditado el 2026-11-16. Este documento no contiene secretos. Los valores reales se entregan por un canal seguro (ver [§9](#9-credenciales-qué-regenerar-y-qué-transferir)).

## 1. Resumen

FINDY ("Pasaporte de Conexiones") es una app de citas. Tiene dos repositorios y dos proyectos de Vercel:

| Pieza | Repo GitHub | Visibilidad | Stack | Hosting |
| --- | --- | --- | --- | --- |
| Frontend (web/PWA + APK Android + iOS) | `sanchodz/Mely-app` (este repo) | **Pública** | React 19, Vite 6, Tailwind 4, Capacitor 8, TanStack Query | Vercel (team `shadownrxs-projects`), URL prod `https://findy-app-ten.vercel.app` |
| Backend "Hacé que pase" API + panel admin | `sanchodz/Mvp` (carpeta `backend/`) | Privada | Node 22, Express, Prisma, Zod | Vercel (team `shadownrxs-projects`), proyecto `hace-que-pase-api`, URL prod `https://hace-que-pase-api.vercel.app` |
| Base de datos | — | — | PostgreSQL en **Neon**, aprovisionada por la integración de Vercel (ex "Vercel Postgres") | Team de Vercel `shadownrxs-projects` |

```
[Web / APK / iOS] ──HTTPS /api/v1──► [API Express en Vercel] ──Prisma──► [Neon Postgres]
        │                                    │
        └──WebSocket (token corto)──► [Ably] ◄┘ publica eventos
                                              ├─► Cloudinary (fotos)
                                              ├─► Resend / SMTP (mails)
                                              ├─► Twilio WhatsApp (OTP teléfono)
                                              ├─► Web Push (VAPID) / Expo Push
                                              └─► Google (verificación de ID token)
```

## 2. Inventario técnico

### Frontend (`sanchodz/Mely-app`)

- Build web: `npm run build` → `dist/`. Vercel lo detecta como proyecto Vite. No hay `vercel.json`.
- PWA con service worker propio (`src/sw.ts`, `vite-plugin-pwa` en modo `injectManifest`) para Web Push.
- Móvil: Capacitor. `appId` / `applicationId` / bundle iOS = `app.findy.pasaporte`. `versionName` sale de `package.json`.
- Cliente HTTP: `src/lib/apiClient.ts` (JWT access 15 min + refresh).
- Realtime: `src/lib/realtime.ts` (Ably, token pedido a `GET /api/v1/realtime/token`).
- Login con Google: `src/components/GoogleAuthButton.tsx` (Google Identity Services).
- Push: `src/hooks/usePushSubscription.ts`.
- `public/google7d3ee1621561d681.html`: verificación de Google Search Console. La propiedad de Search Console pertenece a una cuenta Google: hay que transferirla.
- Dependencias sin uso en el código del cliente (restos de la plantilla AI Studio): `@google/genai`, `express`, `dotenv`. No hay llamadas a Gemini.

### Backend (`sanchodz/Mvp`, raíz `backend/`)

- Entrada Vercel: `backend/src/app.ts`. Fuera de Vercel arranca `backend/src/index.ts` (servidor + `node-cron` cada 15 min).
- Panel admin estático: `/admin` (`backend/public/admin`). El login admin usa un usuario de la base con rol `ADMIN`, creado por `npm run db:seed`.
- Esquema: `backend/prisma/schema.prisma`, 10 migraciones en `backend/prisma/migrations`.
- Alternativas de deploy ya preparadas: `Dockerfile`, `docker-compose.yml` (Postgres local), `railway.toml`.
- Documentación propia: `docs/01…10` en ese repo (instalación, variables, arquitectura, producción, base de datos).

## 3. Variables de entorno

### 3.1 Frontend (todas públicas, se hornean en el bundle)

| Variable | Requerida | Uso |
| --- | --- | --- |
| `VITE_API_URL` | Sí | URL base del backend. Fallback `http://localhost:4000`. Está en `.env.production` (commiteado a propósito: el build del APK en GitHub Actions no tiene env vars). |
| `VITE_GOOGLE_CLIENT_ID` | No | OAuth Client ID web. Igual a `GOOGLE_CLIENT_ID` del backend. |
| `VITE_VAPID_PUBLIC_KEY` | No | Clave pública VAPID. Igual a `VAPID_PUBLIC_KEY` del backend. |
| `DISABLE_HMR` | No | Solo dev. |

Plantilla: [`.env.example`](./.env.example).

### 3.2 Backend (fuente de verdad: `backend/src/config/env.ts` en `sanchodz/Mvp`)

🔒 = secreto. Regenerar o transferir según [§9](#9-credenciales-qué-regenerar-y-qué-transferir).

| Variable | Req. | Notas |
| --- | --- | --- |
| `DATABASE_URL` 🔒 | Sí | Si falta, usa `POSTGRES_PRISMA_URL` o `POSTGRES_URL` (las inyecta la integración Neon de Vercel). |
| `POSTGRES_PRISMA_URL`, `POSTGRES_URL` (+ otras `POSTGRES_*`/`PG*`) 🔒 | — | Las crea y gestiona la integración Neon. No editarlas a mano. |
| `JWT_ACCESS_SECRET` 🔒 | Sí | Mínimo 16 caracteres. |
| `JWT_REFRESH_SECRET` 🔒 | Sí | Mínimo 16 caracteres, distinto del anterior. |
| `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES_DAYS` | No | Defaults `15m`, `30`. |
| `NODE_ENV`, `PORT`, `APP_NAME`, `APP_URL` | No | `APP_URL` = URL pública de la API. |
| `FRONTEND_ORIGIN` | Prod | Orígenes CORS separados por coma. Si queda `*` en prod, el código usa `https://findy-app-ten.vercel.app` hardcodeado (`backend/src/app.ts:27`). **Actualizar si cambia el dominio del frontend.** |
| `CRON_SECRET` 🔒 | Prod | Protege `GET /api/v1/internal/cron`. Vercel Cron lo manda como `Authorization: Bearer`. |
| `MAIL_FROM` | Prod | Remitente. Idealmente en un dominio verificado en Resend. |
| `RESEND_API_KEY` 🔒 | No | Prioridad sobre SMTP. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` 🔒, `SMTP_SECURE` | No | Alternativa a Resend. |
| `EXPOSE_DEV_CODES` | No | Debe ser `false` en prod. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` 🔒, `TWILIO_WHATSAPP_FROM`, `TWILIO_WHATSAPP_CONTENT_SID` | No | OTP de teléfono por WhatsApp. |
| `CLOUDINARY_URL` 🔒 o `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` 🔒 | Prod | Fotos. En Vercel el disco es efímero: sin Cloudinary/S3 las fotos se pierden. |
| `CLOUDINARY_FOLDER` | No | Default `hace-que-pase/photos`. |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_PUBLIC_BASE_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` 🔒 | No | Alternativa a Cloudinary (S3/R2). |
| `UPLOAD_DIR`, `PUBLIC_UPLOAD_URL`, `MAX_PHOTOS` | No | Storage local (solo dev/Docker). |
| `ABLY_API_KEY` 🔒 | Prod | Chat y notificaciones en vivo. |
| `GOOGLE_CLIENT_ID` | No | Verifica ID tokens de Google. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` 🔒, `VAPID_SUBJECT` | No | Web Push. |
| `EXPO_ACCESS_TOKEN` 🔒 | No | Expo Push (documentado, opcional). |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` 🔒 | Seed | Solo los lee `npm run db:seed`. Los defaults del código son públicos: no usarlos en prod. |
| `SEED_DEMO_USERS` | Seed | Crea usuarios demo. No usar en prod. |

Plantilla: `backend/.env.example` en `sanchodz/Mvp`.

### 3.3 GitHub Actions (secrets opcionales del repo frontend)

El workflow reutilizable acepta: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `IOS_CERTIFICATE_BASE64`, `IOS_CERTIFICATE_PASSWORD`, `IOS_PROVISION_PROFILE_BASE64`, `IOS_TEAM_ID`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_BASE64`, `SLACK_WEBHOOK_URL`. Hoy **ninguno está cargado**: el APK/AAB sale firmado con la clave debug y el iOS sale sin firmar (solo Simulador).

## 4. Servicios e integraciones externas

| Servicio | Lo usa | Para qué | Dónde se administra |
| --- | --- | --- | --- |
| GitHub | Ambos repos | Código, CI, releases (APK/AAB en Releases de `sanchodz/Mely-app`) | Cuenta `sanchodz` |
| Vercel | Ambos | Hosting, Cron, env vars, integración Neon, GitHub App "Vercel" | Team `shadownrxs-projects` |
| Neon | Backend | PostgreSQL | Vía integración de Vercel |
| Ably | Front + back | Realtime | Cuenta Ably |
| Cloudinary | Backend | Fotos de perfil | Cuenta Cloudinary |
| Resend (o SMTP) | Backend | Mails (registro, recuperar contraseña) | Cuenta Resend + DNS del dominio de `MAIL_FROM` |
| Twilio | Backend | OTP WhatsApp | Cuenta Twilio |
| Google Cloud | Front + back | OAuth "Continuar con Google" | Proyecto de Google Cloud dueño del Client ID |
| Google Search Console | Front | Verificación del sitio | Cuenta Google |
| Web Push (VAPID) | Front + back | Notificaciones del sistema | Par de claves propio |
| Expo Push | Backend | Push móvil (opcional) | Cuenta Expo |
| Google Fonts, Unsplash | Front | Fuentes, imágenes de ejemplo | Sin cuenta |

## 5. Automatizaciones

| Tipo | Dónde | Qué hace |
| --- | --- | --- |
| GitHub Actions `CI` | `.github/workflows/ci.yml` | En cada push/PR: `npm ci`, `lint`, `test`, `build`. |
| GitHub Actions `Build Mobile` | `.github/workflows/build-mobile.yml` | En push a `main`, PR y manual: llama al workflow reutilizable local `.github/workflows/build-mobile-reusable.yml` (copia de `shadownrx/code` @ `21332a0`) con `secrets: inherit`. |
| Vercel Git integration | Ambos repos | Deploy preview por PR, producción en push a `main`. |
| Vercel Cron | `backend/vercel.json` | `GET /api/v1/internal/cron` todos los días 08:00 UTC: marca matches inactivos, vence propuestas y membresías, recuerda citas. |
| `node-cron` | `backend/src/jobs/index.ts` | Lo mismo cada 15 min, **solo fuera de Vercel** (Docker/Railway). |
| Build del backend | `backend/package.json` → `build` | **Corre `prisma migrate deploy` y `seed-catalog` (upserts) contra la base en cada deploy de Vercel**, incluidos los previews si comparten `DATABASE_URL`. |
| Webhooks de repo | — | No auditados: el token usado no tiene el scope `admin:repo_hook`. Revisar en Settings → Webhooks de cada repo. |

## 6. Instalación local

Requisitos: Node 22, npm, Docker (para Postgres local).

```bash
# Backend
git clone https://github.com/sanchodz/Mvp && cd Mvp/backend
cp .env.example .env            # completar; DATABASE_URL apunta al docker local
docker compose up -d postgres
npm install
npx prisma migrate dev          # SOLO contra la base local
npm run db:seed                 # crea admin con ADMIN_EMAIL/ADMIN_PASSWORD
npm run dev                     # http://localhost:4000

# Frontend
git clone https://github.com/sanchodz/Mely-app && cd Mely-app
cp .env.example .env.local      # VITE_API_URL=http://localhost:4000
npm ci
npm run dev                     # http://localhost:3000
npm run lint && npm test
```

Android local: `npm run android:sync && npm run android:open` (ver `android/BUILD_APK.md`).

## 7. Despliegue

- **Web y API**: merge a `main` → Vercel despliega solo. Variables en Vercel → Project → Settings → Environment Variables.
- **API a mano**: desde `backend/`, `npx vercel deploy --prod --scope <team>`.
- **Cambios de esquema**: crear la migración en local (`npx prisma migrate dev --name <x>`), commitear `prisma/migrations`. El próximo deploy la aplica con `migrate deploy`. Hacer backup/branch en Neon antes de mergear migraciones destructivas.
- **APK/AAB**: subir versión en `package.json` y `MARKETING_VERSION` en `ios/App/App.xcodeproj/project.pbxproj` → push → esperar `Build Mobile` → descargar artefactos → `gh release create vX.Y.Z` en `sanchodz/Mely-app`.
- **Smoke test**: `GET /health`, `GET /api/v1/meta` (muestra qué integraciones están activas), login en la web, login en `/admin`.

## 8. Mantenimiento y recuperación

| Situación | Acción |
| --- | --- |
| Deploy roto | Vercel → Deployments → deploy anterior → "Promote to Production" (rollback instantáneo). |
| Migración rompió datos | Neon → Restore (point-in-time) o crear branch desde un instante previo y apuntar `DATABASE_URL` ahí. La ventana de retención depende del plan de Neon. |
| Backup manual | `pg_dump "$DATABASE_URL_DIRECT" -Fc -f findy-$(date +%F).dump` usando la URL **directa** (sin `-pooler`). Guardarlo cifrado. |
| Restore a base nueva | `pg_restore --no-owner -d "$NUEVA_URL" findy-AAAA-MM-DD.dump` y luego `npx prisma migrate status`. |
| Secreto filtrado | Rotarlo en el proveedor, actualizar en Vercel, redeploy. Rotar JWT cierra todas las sesiones. |
| Fotos rotas | `npm run diagnose:cloudinary` en el backend. |
| CORS bloquea al frontend | Revisar `FRONTEND_ORIGIN` en el backend. |
| Cron no corre | Vercel → Project → Settings → Cron Jobs, y que `CRON_SECRET` exista. |

## 9. Credenciales: qué regenerar y qué transferir

Regla: todo lo que el dueño anterior pudo ver se **regenera** después del traspaso. Lo que no se puede regenerar sin romper algo se **transfiere** como cuenta/recurso, nunca copiando el valor por chat o email. Usar un gestor (1Password/Bitwarden compartido) o cargarlo directo en Vercel.

| Credencial | Acción | Efecto colateral |
| --- | --- | --- |
| Contraseña Neon / `DATABASE_URL` | Regenerar (Neon → Roles → Reset password) después de transferir | Hay que actualizar la env var y redeployar. Si la integración la gestiona, se actualiza sola. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Regenerar | Todos los usuarios deben volver a iniciar sesión. |
| `CRON_SECRET` | Regenerar | Ninguno. |
| `ABLY_API_KEY` | Transferir la cuenta Ably o crear app nueva y regenerar | Breve corte de realtime durante el cambio. |
| Cloudinary | **Transferir la cuenta** (las fotos existentes viven ahí) y luego rotar API secret | Si se crea cuenta nueva, las URLs de fotos actuales dejan de servirse cuando se cierre la vieja. |
| `RESEND_API_KEY` | Regenerar en la cuenta del nuevo dueño; reverificar dominio | Mails caen hasta verificar DNS. |
| Twilio | Regenerar Auth Token o cuenta nueva | El número de WhatsApp está atado a la cuenta Twilio. |
| `VAPID_PRIVATE_KEY` | **No rotar** salvo filtración | Rotar invalida todas las suscripciones push existentes. Transferir el valor de forma segura. |
| Google OAuth Client | Transferir el proyecto de Google Cloud (agregar al nuevo dueño como Owner) | Crear un Client ID nuevo exige cambiar front y back a la vez. |
| Admin del panel | Crear un admin nuevo para el nuevo dueño; cambiar/quitar el admin anterior | Ninguno. |
| Keystore Android | Hoy no existe (firma debug). El nuevo dueño debe generar su propia upload key y guardarla él | Necesario antes de publicar en Google Play. |
| Apple Developer | Cuenta propia del nuevo dueño | Necesario para iOS real. |
| Tokens personales (`gh`, `vercel`) del dueño anterior | Revocar | Ninguno. |

### 9.1 Cómo pasar las variables de entorno

- **Las de Vercel no se pasan a mano.** Al transferir cada proyecto (§10.2) sus env vars se mueven solas, y las de Neon (`POSTGRES_*`, `DATABASE_URL`) las mantiene la integración.
- Si el nuevo dueño necesita una copia local, la baja él mismo desde su team con `vercel env pull .env.local` (en `backend/`, con el proyecto linkeado). Nunca se mandan por chat, email, issue ni PR.
- Lo que no vive en Vercel (logins de Ably, Cloudinary, Resend, Twilio, Google Cloud) se pasa invitando al nuevo dueño como Owner en cada servicio, no compartiendo la clave.
- Si hace falta pasar un valor suelto: bóveda compartida de un gestor (1Password, Bitwarden) o un envío con vencimiento y una sola lectura (Bitwarden Send, 1Password share link). Después se rota igual (§9).
- GitHub Actions hoy no tiene secrets; si se agregan (keystore, Apple), los carga el nuevo dueño en Settings → Secrets.

## 10. Pasos de transferencia

### 10.1 GitHub

Estado actual: ambos repos ya son de `sanchodz` (admin). `shadownrx` sigue como colaborador con `write`.

1. ✅ Hecho: el workflow reutilizable de `shadownrx/code` se copió a `.github/workflows/build-mobile-reusable.yml`. Ya no hay dependencia externa.
2. Revisar Settings → Webhooks, Deploy keys, GitHub Apps instaladas y Branch protection de ambos repos.
3. Al final (ver §12), quitar a `shadownrx` como colaborador.
4. Opcional: hacer privado `sanchodz/Mely-app` si no se quiere el código expuesto.

### 10.2 Vercel

Los dos proyectos viven en el team `shadownrxs-projects`.

1. El nuevo dueño crea su propio team de Vercel (Pro si va a ser uso comercial; Hobby no permite uso comercial).
2. Instalar la GitHub App de Vercel en la cuenta `sanchodz` con acceso a `Mely-app` y `Mvp`.
3. **Primero la base**: transferir el recurso Neon (ver §10.3). Así evitás que el proyecto backend quede apuntando a una base de otro team.
4. Transferir el proyecto backend: Project → Settings → General → Transfer Project → team destino. Se mueven deployments, dominios y env vars. Las integraciones hay que reconectarlas después.
5. Transferir el proyecto frontend igual.
6. En el team destino: reconectar integraciones, revisar que estén todas las env vars (Production y Preview), Cron Jobs activo y Git conectado a los repos de `sanchodz`.
7. Hacer un deploy de prueba y el smoke test de §7.
8. Si en algún momento se agrega un dominio propio: transferirlo o delegarlo al nuevo team antes de cambiar DNS. Hoy solo se usan dominios `*.vercel.app`, que se mueven con el proyecto.

Durante una transferencia de proyecto no se puede deployar ni editar settings; tarda entre segundos y ~10 minutos.

### 10.3 Neon

La base fue creada por la integración de Vercel, así que vive dentro del team de Vercel.

- **Opción A (preferida):** Vercel → Storage → la base Neon → Settings → transferir el recurso al team del nuevo dueño. Si aparece "Feature not enabled for your team", pedir a Vercel Support que lo habilite.
- **Opción B:** transferir el proyecto de Vercel; según Neon, el proyecto Neon vinculado se mueve a la organización Neon del team nuevo. Verificar en el dashboard que efectivamente se movió.
- **Opción C (fallback, requiere ventana de mantenimiento):** crear una base nueva en la cuenta del nuevo dueño, `pg_dump` desde la URL directa, `pg_restore` en la nueva, cambiar `DATABASE_URL`, redeploy. Hay pérdida de escrituras hechas entre el dump y el cambio salvo que se ponga la app en mantenimiento.

Antes de cualquier opción: hacer un `pg_dump` y guardar el archivo cifrado. Después: rotar la contraseña del rol (§9).

## 11. Riesgos y posibles interrupciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Cada deploy del backend corre `prisma migrate deploy` | Un preview con la misma `DATABASE_URL` que producción aplica migraciones a producción. | Usar branch de Neon por preview o una `DATABASE_URL` distinta en Preview. |
| Base gestionada por la integración de Vercel | Si se transfiere el proyecto antes que la base, o se desinstala la integración, la API se queda sin base. | Orden de §10.2. No desinstalar la integración vieja hasta verificar la nueva. |
| `FRONTEND_ORIGIN` / fallback hardcodeado a `findy-app-ten.vercel.app` | Cambiar el dominio del front rompe CORS. | Actualizar `FRONTEND_ORIGIN` antes de cambiar dominio. |
| `VITE_API_URL` horneado en el APK | Cambiar la URL del backend deja sin servicio a los APK instalados. | Mantener la URL actual o usar un dominio propio estable antes de distribuir más APKs. |
| Rotar JWT | Todos los usuarios deben reloguearse. | Avisar o hacerlo en horario bajo. |
| Rotar VAPID | Se pierden todas las suscripciones push. | No rotar sin necesidad. |
| Cuenta Cloudinary nueva | Fotos existentes inaccesibles. | Transferir la cuenta, no recrearla. |
| APK firmado con clave debug | No se puede publicar en Google Play; una futura clave real obliga a reinstalar. | Generar keystore propio antes de publicar. |
| Repo frontend público | Cualquier secreto que se commitee queda expuesto. | Nunca poner secretos en `VITE_*` ni en `.env.production`. Historial auditado: sin secretos. |
| Admin seed con defaults públicos | Si prod se sembró sin `ADMIN_PASSWORD`, el panel queda con credenciales conocidas. | Verificar y cambiar el admin en prod. |
| Webhooks no auditados | Puede haber destinos externos recibiendo eventos. | Revisarlos a mano (§10.1 paso 4). |

## 12. Checklist final de desvinculación

Hacer en este orden. Marcar cada uno solo después de verificarlo.

**Preparación**
- [ ] Backup `pg_dump` de producción guardado cifrado por el nuevo dueño.
- [ ] Inventario de valores de env vars exportado al gestor de secretos del nuevo dueño (no por chat).
- [ ] Nuevo dueño con cuentas propias: Vercel (team), Neon, Ably, Cloudinary, Resend, Twilio, Google Cloud, Apple/Google Play si aplica.

**Transferencias**
- [x] Workflow reutilizable copiado al repo (`build-mobile-reusable.yml`), sin dependencia de `shadownrx/code`.
- [ ] Recurso Neon transferido al team del nuevo dueño.
- [ ] Proyecto Vercel backend transferido; integraciones reconectadas; env vars verificadas; Cron activo.
- [ ] Proyecto Vercel frontend transferido; env vars verificadas.
- [ ] Cuentas Ably, Cloudinary, Resend, Twilio transferidas o reemplazadas.
- [ ] Proyecto de Google Cloud (OAuth) con el nuevo dueño como Owner.
- [ ] Propiedad de Google Search Console transferida.
- [ ] Smoke test OK: `/health`, `/api/v1/meta`, login web, login Google, chat en vivo, subida de foto, mail de recuperación, `/admin`.

**Rotación** (después de que todo funciona en las cuentas nuevas)
- [ ] Contraseña del rol Neon rotada.
- [ ] `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CRON_SECRET` regenerados.
- [ ] API keys de Ably, Cloudinary, Resend, Twilio rotadas.
- [ ] Admin del panel propio del nuevo dueño; admin anterior eliminado o con contraseña cambiada.

**Desvinculación del dueño anterior**
- [ ] `shadownrx` quitado como colaborador de `sanchodz/Mely-app` y `sanchodz/Mvp`.
- [ ] Dueño anterior quitado de: team de Vercel, organización Neon, Ably, Cloudinary, Resend, Twilio, Google Cloud, Search Console.
- [ ] Tokens personales del dueño anterior (`gh`, `vercel`, deploy keys) revocados.
- [ ] Team `shadownrxs-projects` sin proyectos ni recursos de FINDY.
- [ ] El nuevo dueño confirma por escrito que opera sin acceso del dueño anterior.
