FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

# Installer les dépendances
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copier tout le code et générer Prisma + Build Next.js
COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Créer/mettre à jour la base SQLite, seeder les comptes/environnements, puis lancer le serveur
CMD ["sh", "-c", "npx prisma db push && npx tsx prisma/seed.ts && npm run start"]