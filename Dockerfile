FROM node:8

# install dependencies
ADD package-lock.json /src/openhim-core/
ADD package.json /src/openhim-core/
WORKDIR /src/openhim-core/
RUN npm install

# add app
ADD . /src/openhim-core/

CMD npm run build && node lib/server.js
