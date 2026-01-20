# Glyph Docs - Astro/Starlight Site
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Production stage - serve static files
FROM node:20-alpine

WORKDIR /app

# Install serve globally
RUN npm install -g serve

# Copy built assets
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Serve the built docs - use PORT env var for Railway compatibility
# Note: Do NOT use -s flag (SPA mode) as Astro generates static HTML for each route
ENV PORT=3000
CMD ["sh", "-c", "serve dist -l tcp://0.0.0.0:${PORT}"]
