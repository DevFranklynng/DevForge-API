FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json package-lock.json ./

# Persistent SQLite data volume (mount e.g. /data and set DATABASE_URL=file:/data/devforge.db).
VOLUME /data
ENV DATABASE_URL=file:/data/devforge.db

EXPOSE 4000
CMD ["sh", "-c", "npm exec prisma db push && node dist/index.js"]