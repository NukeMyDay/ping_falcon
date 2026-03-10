FROM node:20-alpine

# Build tools needed for better-sqlite3 (native module)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p data

EXPOSE 3000

CMD ["node", "server.js"]
