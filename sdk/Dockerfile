FROM node:20-slim

WORKDIR /app

# Install serve globally
RUN npm install -g serve

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Build the SDK
COPY . .
RUN npm run build

# Expose port and serve from dist
EXPOSE 3000
CMD ["serve", "dist", "-s", "-l", "3000", "--cors"]
