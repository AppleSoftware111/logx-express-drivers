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

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package*.json ./
COPY --from=builder /app/packages/i18n/dist ./node_modules/@logx/i18n/dist
COPY --from=builder /app/packages/i18n/package.json ./node_modules/@logx/i18n/
COPY --from=builder /app/packages/shared/dist ./node_modules/@logx/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@logx/shared/

RUN npm ci --omit=dev

EXPOSE 4000

CMD ["node", "dist/index.js"]
