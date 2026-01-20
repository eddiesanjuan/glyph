# Glyph WWW - Static Landing Page
FROM node:20-alpine

WORKDIR /app

# Install serve globally
RUN npm install -g serve

# Copy static files
COPY . .

EXPOSE 3000

# Serve static files - use PORT env var for Railway compatibility
ENV PORT=3000
CMD ["sh", "-c", "serve -s . -l tcp://0.0.0.0:${PORT}"]
