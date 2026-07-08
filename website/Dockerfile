FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build
# Drop devDependencies (typescript, eslint, @types/*) so the runner stage
# only ships what `next start` needs.
RUN npm prune --omit=dev --legacy-peer-deps

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
RUN chown -R node:node /app/.next
USER node
EXPOSE 3001
CMD ["npm", "run", "start"]
