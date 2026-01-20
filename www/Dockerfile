FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY . .
EXPOSE 3000
CMD ["serve", "-s", ".", "-l", "tcp://0.0.0.0:3000"]
