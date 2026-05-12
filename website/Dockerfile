FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
# Drop privileges. node:20-alpine ships a `node` user (UID 1000); chown the
# Next.js build dir so revalidation/cache writes succeed without root.
RUN chown -R node:node /app/.next
USER node
EXPOSE 3001
CMD ["npm", "run", "start"]
