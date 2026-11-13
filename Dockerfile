FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

# Installer les dépendances
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
# Install Chromium and its Linux shared libraries for live crawls and evidence capture.
RUN npx playwright install --with-deps chromium

# Copier tout le code et générer Prisma + Build Next.js
COPY . .
RUN npx prisma generate
RUN npm run build
RUN mkdir -p /app/.qasyn-data /app/prisma/data

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Ensure the persistent data directory exists, sync SQLite, seed only an empty database, then start.
CMD ["sh", "-c", "mkdir -p /app/.qasyn-data && npx prisma db push && (npx tsx scripts/db-has-data.ts || npx tsx prisma/seed.ts) && npm run start"]