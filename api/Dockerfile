FROM node:20-slim

WORKDIR /app

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Install Playwright browsers for PDF generation
RUN npx playwright install chromium --with-deps

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Copy templates directory (needed for template rendering)
COPY templates /templates

ENV PORT=3000
EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
