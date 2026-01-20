# Glyph Dashboard - Vite/Preact App
FROM node:20-alpine AS builder

WORKDIR /app

# Build argument for API URL (Vite env vars are baked in at build time)
ARG VITE_API_URL=https://glyph-api-production-3f73.up.railway.app
ENV VITE_API_URL=${VITE_API_URL}

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build with env var
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

# Serve the built app - use PORT env var for Railway compatibility
ENV PORT=3000
CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT}"]
