FROM node:14.17.0 as build

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package*.json ./
COPY . .
RUN npm uninstall babel && npm install --save-dev babel-cli && npm install --global parcel-bundler
RUN npm install
RUN npm run build

FROM node:14.17-alpine
RUN mkdir -p /app
WORKDIR /app

COPY --from=build /usr/src/app  /app

CMD [ "node", "lib/server.js" ]