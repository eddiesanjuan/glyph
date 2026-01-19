FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN bun install

# Install Playwright browsers for PDF generation
RUN bunx playwright install chromium --with-deps

# Copy source code
COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
