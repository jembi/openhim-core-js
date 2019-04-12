FROM node:carbon-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

COPY performance/mediator/package.json /usr/src/app/
RUN npm install && npm cache clean --force
COPY performance/mediator /usr/src/app

CMD ["npm", "start"]
