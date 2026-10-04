FROM node:22-alpine

RUN apk add --no-cache poppler-utils
WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
ENV PORT=80
EXPOSE 80

CMD ["node", "backend/server.js"]
