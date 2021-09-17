FROM node:14.17-alpine

RUN apk upgrade --update-cache --available && \
    apk add openssl && \
    rm -rf /var/cache/apk/*

WORKDIR /app

COPY . .

RUN npm install

RUN npm run build

CMD ["node", "lib/server.js"]
