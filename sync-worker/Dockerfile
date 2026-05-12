# TamamHealth sync-worker.
#
# Long-running Node 20 process that polls CouchDB _changes for every
# tamamhealth_* database, HMACs each batch, and POSTs to the platform's
# /api/sync webhook so PostgreSQL analytics stays current.
#
# Self-contained: only Node built-ins (fetch, crypto, fs, http). No npm deps.

FROM node:20-alpine

# Run as a non-root user. node:20-alpine ships with a `node` user (UID 1000).
# Create the state directory and chown it so SIGTERM-driven flushes work
# without root.
RUN mkdir -p /var/lib/sync-worker && chown -R node:node /var/lib/sync-worker

WORKDIR /app

COPY package.json ./
COPY index.mjs ./

USER node

ENV NODE_ENV=production \
    STATE_FILE=/var/lib/sync-worker/state.json

# CouchDB replication catch-up can be bursty; surface that via stdout rather
# than a healthcheck endpoint (the worker has no HTTP listener of its own).
CMD ["node", "index.mjs"]
