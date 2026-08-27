# ============================================================
# PDF to TXT — image Docker
# Contient le serveur Next.js ET le worker de conversion
# (pdftotext), 100 % local.
# ============================================================

# ---------- Étape de construction ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Outils de compilation pour better-sqlite3 (si pas de binaire précompilé)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- Étape d'exécution ----------
FROM node:20-bookworm-slim
# pdftotext (poppler-utils) requis pour la conversion
RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# node_modules complet (dev inclus : tsx est requis pour exécuter le worker)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/worker ./worker
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/db ./db

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Répertoire des données persistantes (PDF, TXT, base SQLite)
VOLUME ["/app/data"]

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
