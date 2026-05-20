# 🍎 Manzana.es

Comparador de precios Apple en España — Next.js 14 + Prisma (SQLite) + ScraperAPI + Claude AI

---

## Stack

| Capa        | Tecnología                          |
|-------------|-------------------------------------|
| Frontend    | Next.js 14 App Router + React 18    |
| Backend     | Next.js API Routes                  |
| Base datos  | SQLite (Prisma ORM)                 |
| Scraping    | ScraperAPI + Claude AI (extracción) |
| IA chat     | Claude Haiku (Anthropic API)        |
| Fotos       | Upload local `/public/uploads/`     |

---

## Instalación rápida

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Edita .env.local con tus claves

# 3. Crear base de datos y migrar
npx prisma migrate dev --name init

# 4. Sembrar datos iniciales
npm run db:seed

# 5. Arrancar en desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## Variables de entorno (.env.local)

```env
DATABASE_URL="file:./dev.db"

# Obtén tu clave en https://www.anthropic.com
ANTHROPIC_API_KEY="sk-ant-..."

# Obtén tu clave en https://scraperapi.com (plan gratuito: 1000 llamadas/mes)
SCRAPER_API_KEY=""

NEXT_PUBLIC_APP_URL="http://localhost:3000"
UPLOAD_DIR="./public/uploads"
```

---

## Cómo activar el scraping real

1. Regístrate en [scraperapi.com](https://scraperapi.com) → copia tu API Key
2. Añade `SCRAPER_API_KEY=tu_clave` a `.env.local`
3. El botón "↻ Actualizar precios" llamará a `/api/prices/scrape`
4. ScraperAPI descarga la página de cada tienda
5. Claude Haiku extrae el precio del HTML automáticamente

> **Sin SCRAPER_API_KEY** la app funciona en modo demo con precios de la base de datos.

---

## API Routes

| Método | Ruta                      | Descripción                        |
|--------|---------------------------|------------------------------------|
| GET    | `/api/products`           | Lista todos los productos           |
| GET    | `/api/products/:id`       | Detalle de un producto              |
| GET    | `/api/listings`           | Anuncios de segunda mano           |
| POST   | `/api/listings`           | Crear anuncio (multipart/form-data)|
| DELETE | `/api/listings/:id`       | Desactivar anuncio                 |
| POST   | `/api/prices/scrape`      | Lanzar scraping de precios         |
| GET    | `/api/prices/scrape`      | Obtener precios actuales           |
| POST   | `/api/ai`                 | Chat con asistente IA              |

---

## Estructura del proyecto

```
manzana-es/
├── prisma/
│   ├── schema.prisma       # Modelos de base de datos
│   └── seed.js             # Datos iniciales
├── src/
│   ├── app/
│   │   ├── layout.js
│   │   ├── page.js
│   │   └── api/
│   │       ├── products/   # CRUD productos
│   │       ├── listings/   # Anuncios 2ª mano
│   │       ├── prices/     # Scraping precios
│   │       └── ai/         # Asistente IA
│   ├── components/
│   │   └── ManzanaApp.jsx  # App principal (cliente)
│   └── lib/
│       ├── prisma.js       # Cliente Prisma singleton
│       ├── scraper.js      # Motor de scraping
│       └── upload.js       # Gestión de archivos
├── public/
│   └── uploads/            # Fotos subidas por usuarios
└── .env.example
```

---

## Deploy en Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Variables de entorno en Vercel Dashboard:
# DATABASE_URL, ANTHROPIC_API_KEY, SCRAPER_API_KEY
```

> Para producción se recomienda migrar de SQLite a **PostgreSQL** (Supabase, Neon, o Railway son gratuitos).
> Cambia en `prisma/schema.prisma`: `provider = "postgresql"` y actualiza `DATABASE_URL`.

---

## Funcionalidades

- 🏠 **Página de inicio** con Novedades, Más populares, Mejor bajada de precio
- 🛒 **Catálogo** con filtros por categoría, búsqueda y ordenación
- 📊 **Comparador de precios** en 8 tiendas españolas con barras visuales
- 🤖 **Asistente IA** integrado (Claude)
- 🖼️ **Galería de colores** por producto
- 📋 **Características** completas por producto
- ⭐ **Reseñas** de medios especializados
- 📈 **Historial de precios** con gráfico SVG
- 📦 **Segunda mano** con upload de fotos y URLs
- ↻ **Scraping en tiempo real** con ScraperAPI + extracción IA
