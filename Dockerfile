FROM node:20-bookworm-slim
WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci && npx playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/*

COPY . .
RUN npx prisma generate && npm run build && mkdir -p /app/.qasyn-data /app/prisma/data

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/prisma/data/qasyn.db"

CMD ["sh", "-c", "mkdir -p /app/.qasyn-data /app/prisma/data && npx prisma db push && (npx tsx scripts/db-has-data.ts || npx tsx prisma/seed.ts) && npm run start"]
