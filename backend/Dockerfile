FROM node:25-alpine
ARG KERJADESA_COMMIT=unknown
ARG KERJADESA_BUILD=unknown

RUN apk add --no-cache poppler-utils
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
ENV NODE_ENV=production
ENV KERJADESA_COMMIT=$KERJADESA_COMMIT
ENV KERJADESA_BUILD=$KERJADESA_BUILD
EXPOSE 3000
CMD ["npm","start"]
