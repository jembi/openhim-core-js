FROM node:14.21.3-alpine as build

WORKDIR /build

COPY . .

RUN npm install && npm run build

FROM node:14.21.3-alpine

ENV NODE_ENV=production

RUN apk upgrade --update-cache --available && \
    apk add openssl && \
    rm -rf /var/cache/apk/*

WORKDIR /app

COPY --from=build ./build/lib ./lib

COPY . .

RUN npm install --production

CMD ["node", "lib/server.js"]
