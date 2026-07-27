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
# Demo mode is read as `NEXT_PUBLIC_DEMO_MODE !== 'false'` (src/lib/db-seed.ts),
# i.e. it is OPT-OUT, and NEXT_PUBLIC_* is inlined into the client bundle at
# BUILD time. A runtime `environment:` entry in docker-compose therefore cannot
# switch it off in an image that was built without it — the image would seed
# fictional patients into every clinician's browser.
#
# Default to "false" so a build that forgets the arg produces a REAL-mode image.
# That is the fail-safe direction: a real-mode image refuses to boot without PHI
# encryption configured (lib/config-validation.ts), whereas a demo-mode image
# would boot happily and quietly seed fake patients.
#
# The public demo deployment must pass --build-arg NEXT_PUBLIC_DEMO_MODE=true
# explicitly.
ARG NEXT_PUBLIC_DEMO_MODE=false
ENV NEXT_TELEMETRY_DISABLED=1
RUN JWT_SECRET="$JWT_SECRET" NEXT_PUBLIC_DEMO_MODE="$NEXT_PUBLIC_DEMO_MODE" npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Re-declared because ARGs do not cross build stages. Recorded as a label so
# the mode baked into the client bundle is inspectable AFTER the fact —
# deploy-production.yml reads it and refuses to promote a demo-mode image to
# production. Without this the flag is invisible once the image is built.
ARG NEXT_PUBLIC_DEMO_MODE=false
LABEL org.tamamhealth.demo-mode="${NEXT_PUBLIC_DEMO_MODE}"
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
