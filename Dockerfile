# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY nest-cli.json tsconfig.json tsconfig.build.json knexfile.ts ./
COPY src ./src

RUN yarn build \
  && yarn install --frozen-lockfile --production \
  && yarn cache clean

# ── Stage 2: production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs \
  && adduser -S nestjs -u 1001 -G nodejs

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

USER nestjs

EXPOSE 3000

CMD ["node", "dist/main.js"]
