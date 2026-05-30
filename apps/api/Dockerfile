FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/i18n/package*.json ./packages/i18n/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/tsconfig ./packages/tsconfig/

RUN npm ci --workspace=@logx/shared --workspace=@logx/i18n --workspace=@logx/api

COPY packages/i18n ./packages/i18n
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm run build --workspace=@logx/shared
RUN npm run build --workspace=@logx/i18n
RUN npm run build --workspace=@logx/api

# ──────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV CACHE_BUST=2

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/i18n/package*.json ./packages/i18n/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/tsconfig ./packages/tsconfig/

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/i18n/dist ./packages/i18n/dist

# ✅ Copy source locales (referenced as ../locales/ relative to dist/)
COPY --from=builder /app/packages/i18n/locales ./packages/i18n/locales

RUN npm ci --omit=dev --workspace=@logx/shared --workspace=@logx/i18n --workspace=@logx/api

COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 4000

CMD ["node", "apps/api/dist/index.js"]