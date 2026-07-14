FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
# `next build` collects page data for API routes whose auth helpers refuse to
# run in production without JWT_SECRET. The real secret is injected at runtime;
# this build-time value only satisfies the guard. Builder-stage only — never
# reaches the runtime image. Mirrors ci.yml.
ARG JWT_SECRET=docker-build-time-placeholder-not-used-at-runtime
ENV NEXT_TELEMETRY_DISABLED=1
RUN JWT_SECRET="$JWT_SECRET" npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
# The Postgres migration runner (`src/lib/db/migrate.ts`) loads `.sql` files
# from `process.cwd()/src/lib/db/migrations` at boot via `instrumentation.ts`.
# These are not picked up by `next build` (Next only bundles JS/TS), so the
# raw SQL has to be copied into the runner image explicitly. Without this,
# the boot-time migration runner finds zero files and silently no-ops —
# meaning a fresh deploy ships with an empty analytics schema.
COPY --from=builder /app/src/lib/db/migrations ./src/lib/db/migrations
# Drop privileges. The `node` user (UID 1000) is shipped by node:20-alpine.
# Required for the writable scratch dirs Next.js needs (.next/cache during
# revalidation) so we chown those before switching.
RUN chown -R node:node /app/.next
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
