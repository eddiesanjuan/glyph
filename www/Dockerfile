FROM node:20-slim

WORKDIR /app

# Install serve globally
RUN npm install -g serve

# Copy all static files
COPY . .

# Expose port and serve static files
EXPOSE 3000
CMD ["serve", ".", "-s", "-l", "3000"]
