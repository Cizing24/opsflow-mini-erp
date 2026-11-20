FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --no-fund
COPY . .
RUN DATABASE_URL=mysql://build:build@localhost:3306/opsflow_demo npm run db:generate && npm run build
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@opsflow/api"]
