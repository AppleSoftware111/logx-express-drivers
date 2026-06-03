# LOGX BioPoli

Production-grade healthcare logistics SaaS platform for hospital and laboratory courier operations in Brazil.

## Architecture

| Layer | Technology |
|---|---|
| Web Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Mobile App | React Native (Expo SDK 51) |
| Backend API | Node.js, Express, TypeScript |
| Database | MongoDB Atlas (Mongoose 8) |
| Cache / Queues | Redis (Upstash or self-hosted) |
| Real-time | Socket.io |
| File Storage | AWS S3 |
| Maps | Google Maps JavaScript API |
| Notifications | Twilio / Z-API (WhatsApp) |

## Monorepo Structure

```
logx-express/
├── apps/
│   ├── api/          ← Express REST API + Socket.io server
│   ├── web/          ← Next.js 14 admin panel + client portal
│   └── mobile/       ← Expo React Native driver app
├── packages/
│   ├── shared/       ← Zod schemas, TypeScript types, constants
│   ├── i18n/         ← Translations (pt, es, en), API error codes, Zod error maps
│   ├── tsconfig/     ← Shared TypeScript configs
│   └── eslint-config/ ← Shared ESLint config
└── docker-compose.yml
```

## Internationalization (i18n)

Supported languages: **Portuguese (default)**, **Spanish**, **English**.

| App | Library | Locale storage |
|-----|---------|----------------|
| Web | [next-intl](https://next-intl-docs.vercel.app/) | Cookie `LOGX_LOCALE` (no URL prefix) |
| Mobile | i18next + expo-localization | AsyncStorage `LOGX_LOCALE` |
| API | `@logx/i18n` | `Accept-Language` header → localized error messages |

### Adding a string

1. Add the key to `packages/i18n/locales/pt/<namespace>.json`
2. Mirror in `locales/es/` and `locales/en/` (or run `node packages/i18n/scripts/merge-locales.mjs` then translate)
3. Web: `useTranslations('namespace')` → `t('yourKey')`
4. Mobile: `useTranslation()` → `t('namespace.yourKey')`
5. API errors: use `ApiErrorCode` from `@logx/i18n`, not raw strings

### QA locale cookie

Set `LOGX_LOCALE=pt|es|en` in browser devtools → Application → Cookies, then refresh.

### Scripts

```bash
npm run check-keys --workspace=@logx/i18n   # verify es/en have all pt keys
npm run test --workspace=@logx/i18n         # resolveLocale + error message smoke tests
```

## Quick Start

### Prerequisites

- Node.js >= 20
- npm >= 10
- MongoDB Atlas account (or local MongoDB 7+)
- Redis (Upstash or local)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a root `.env` file manually and populate the required backend variables from
[`apps/api/src/config/env.ts`](apps/api/src/config/env.ts), plus the web/mobile runtime
URLs used by your environment.

Minimum local values:

```bash
NODE_ENV=development
PORT=4000
MONGODB_URI=<your-mongodb-uri>
REDIS_URL=redis://localhost:6379
JWT_SECRET=<32+ char secret>
JWT_REFRESH_SECRET=<32+ char secret>
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
APP_TIMEZONE=America/Sao_Paulo
```

### 3. Seed Super Admin

```bash
npm run seed --workspace=@logx/api
```

### 4. Start Development

```bash
npm run dev
```

This starts:
- API server on `http://localhost:4000`
- Web app on `http://localhost:3000`

### 5. Mobile App (driver APK)

```bash
cd apps/mobile
set EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
npm run generate:assets
npm start
```

**Build installable APK:** see [apps/mobile/BUILD_ANDROID.md](apps/mobile/BUILD_ANDROID.md)

```bash
cd apps/mobile
eas login
eas init
npm run build:apk:cloud
```

Production mobile builds must provide `EXPO_PUBLIC_API_URL` explicitly. The production
Expo config now fails fast if this value is missing.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh token |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/companies` | Companies |
| GET/POST | `/api/drivers` | Drivers |
| GET/POST | `/api/clients` | Clients |
| GET/POST | `/api/routes` | Routes |
| GET | `/api/executions/today` | Today's executions |
| POST | `/api/executions/:id/stops/:stopId/arrived` | Mark arrived |
| POST | `/api/executions/:id/stops/:stopId/complete` | Complete stop |
| POST | `/api/pod/:executionId/stops/:stopId` | Upload POD |
| GET | `/api/dashboard/summary` | Dashboard stats |
| GET | `/api/reports/summary` | Performance reports |
| GET | `/api/reports/csv` | Export CSV |

## Socket.io Events

| Event | Direction | Description |
|---|---|---|
| `driver:location` | Driver → Server | GPS update (every 5s) |
| `admin:driver_location` | Server → Admin | Broadcast live position |
| `admin:alert` | Server → Admin | New delay alert |
| `driver:arrived_confirmed` | Server → Driver | Geofence arrival |

## Deployment

```bash
# Build images from the monorepo root and start local containers
docker-compose up -d --build
```

For AWS ECS + GitHub Actions CI/CD deployment, see:
- [docs/deployment/aws-github-actions.md](docs/deployment/aws-github-actions.md)

## Key Features

- **Multi-tenant**: Every query scoped by `companyId` from JWT
- **Real-time GPS**: Socket.io + 30s bulk DB insert buffer
- **Geofencing**: Auto-detect arrival within 100m of stop
- **Delay Detection**: Cron job every 5 min, WhatsApp alerts
- **GPS Replay**: Full playback with animated marker + scrubber
- **POD**: Photo + signature upload to private S3 bucket
- **Reports**: MongoDB aggregation pipeline, CSV export
- **Driver Substitution**: Preserves original driver in history
