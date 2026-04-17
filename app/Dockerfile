# =============================================================================
# Stage 1: Development - For local development with hot reload
# Uses npm ci for faster, deterministic installs
# =============================================================================
FROM node:24-alpine AS development

WORKDIR /usr/src/app

# Copy package files first for better layer caching
COPY package*.json ./

# Use npm ci for faster, reproducible installs
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

EXPOSE 3002

# Default command for development
CMD ["npm", "run", "start:dev"]

# =============================================================================
# Stage 2: Build - For production compilation
# =============================================================================
FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

RUN npm run build

# Remove dev dependencies
RUN npm prune --production --legacy-peer-deps

# =============================================================================
# Stage 3: Production - Minimal runtime image
# Runs as non-root user for security
# =============================================================================
FROM node:24-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

WORKDIR /app

# Copy only production dependencies and compiled code
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/package.json ./
COPY --from=build --chown=nestjs:nodejs /app/database ./database
COPY --from=build --chown=nestjs:nodejs /app/scripts ./scripts

USER nestjs

ENV NODE_ENV=production

EXPOSE 3000

CMD ["sh", "./scripts/docker/start.sh"]