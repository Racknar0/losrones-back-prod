# Backend Losrones API

API REST para autenticacion, gestion operativa de tienda, inventario, ventas y modulo de e-commerce interno.

## 1) Resumen

Este servicio expone endpoints bajo el prefijo `/losrones` y usa:

- Node.js + Express
- Prisma ORM + MySQL
- JWT para autenticacion
- Multer + Sharp para carga de imagenes
- Nodemailer para flujos de correo

## 2) Stack tecnico

- Runtime: Node.js (ES Modules)
- Framework: Express 4
- ORM: Prisma 6
- Base de datos: MySQL
- Auth: jsonwebtoken + bcrypt
- Uploads: multer + sharp
- Dev tools: nodemon

## 3) Estructura del proyecto

```text
backend/
├─ app.js
├─ package.json
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ seed/
│  └─ seed.js
├─ src/
│  ├─ controllers/
│  ├─ middlewares/
│  ├─ routes/
│  └─ utils/
└─ uploads/
```

## 4) Requisitos

- Node.js 18+
- MySQL disponible
- Variables de entorno configuradas

## 5) Instalacion

```bash
npm install
```

## 6) Variables de entorno

Crea un archivo `.env` en la raiz de `backend`.

Variables usadas por el proyecto:

- `DATABASE_URL` (Prisma / MySQL)
- `JWT_SECRET`
- `PORT` (opcional, default: 5001)
- `ENV` (development | production)
- `TOKEN_VERSION` (opcional, default: 1)
- `SMTP_HOST`
- `SMTP_PORT`
- `EMAIL_USER`
- `EMAIL_PASS`

Ejemplo base:

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DB_NAME"
JWT_SECRET="cambia-esto-por-un-secreto-fuerte"
PORT=5001
ENV=development
TOKEN_VERSION=1
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
EMAIL_USER=tu-correo@dominio.com
EMAIL_PASS=tu-password-o-app-password
```

## 7) Scripts disponibles

```bash
npm run dev      # nodemon app.js
npm run start    # node app.js
npm run seed     # ejecuta seed/seed.js
```

## 8) Base de datos y Prisma

Flujo recomendado despues de cambios en schema:

```bash
npx prisma migrate dev --name nombre_del_cambio
npx prisma generate
```

Si necesitas datos iniciales:

```bash
npm run seed
```

> Nota: el seed actual trunca tablas principales antes de insertar datos base.

## 9) Ejecucion local

```bash
npm run dev
```

Servidor local:

- API base: `http://localhost:5001/losrones`
- Health test: `GET /losrones/test`

## 10) Modulos de rutas

Todas las rutas cuelgan de `/losrones`.

- `/auth`
- `/users`
- `/roles`
- `/stores`
- `/category`
- `/product`
- `/stock`
- `/sale`
- `/coupons`
- `/movements`
- `/cortes`
- `/store-items`

## 11) Uploads de imagenes

El middleware de uploads:

- Acepta solo `image/*`
- Limite por archivo: **15 MB**
- Convierte automaticamente imagenes a **WebP**
- Guarda en `uploads/<carpeta>/...webp`

Archivos estaticos expuestos en:

- `/losrones/uploads/...`

## 12) Autenticacion y autorizacion

- JWT via header `Authorization: Bearer <token>`
- Middleware de autenticacion: `authMiddleware`
- Middleware de permisos por rol: `permitMiddleware`

## 13) Produccion

En `ENV=production`, `app.js` levanta HTTPS usando certificados de Let's Encrypt en rutas del servidor.

Ajusta estas rutas segun tu infraestructura:

- `/etc/letsencrypt/live/.../privkey.pem`
- `/etc/letsencrypt/live/.../fullchain.pem`

## 14) Troubleshooting rapido

### MulterError: File too large

La imagen excede 15 MB por archivo.

### Error Prisma de migracion o cliente desactualizado

Ejecuta:

```bash
npx prisma migrate dev --name fix
npx prisma generate
```

### 401 Unauthorized

Verifica token JWT y `JWT_SECRET`.

---

Si quieres, se puede extender este README con ejemplos de request/response por modulo y una coleccion de Postman versionada en el repo.
