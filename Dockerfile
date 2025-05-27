FROM node:23-alpine AS builder

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:23-alpine AS production

ENV NODE_ENV production
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /usr/src/app/dist ./dist
EXPOSE ${PORT:-3000}

CMD ["node", "dist/main.js"]