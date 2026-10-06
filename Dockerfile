FROM node:26-alpine
ARG KERJADESA_COMMIT=unknown
ARG KERJADESA_BUILD=unknown

RUN apk add --no-cache poppler-utils
WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
ENV KERJADESA_COMMIT=$KERJADESA_COMMIT
ENV KERJADESA_BUILD=$KERJADESA_BUILD
ENV PORT=80
EXPOSE 80

CMD ["node", "backend/server.js"]
