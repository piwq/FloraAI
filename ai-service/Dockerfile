FROM node:18-alpine AS builder

WORKDIR /app

COPY app/package*.json ./

RUN npm install --only=production

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY app/ .

EXPOSE 3002

CMD ["node", "index.js"]