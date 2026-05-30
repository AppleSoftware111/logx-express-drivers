FROM node:20-alpine AS builder

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_MAPS_KEY

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GOOGLE_MAPS_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_KEY

WORKDIR /app

COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/i18n/package*.json ./packages/i18n/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/tsconfig ./packages/tsconfig/

RUN npm ci --install-strategy=nested --workspace=@logx/shared --workspace=@logx/i18n --workspace=@logx/web

COPY packages/i18n ./packages/i18n
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN npm run build --workspace=@logx/shared
RUN npm run build --workspace=@logx/i18n
RUN npm run build --workspace=@logx/web

# ──────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
