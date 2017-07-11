FROM node:boron

RUN npm install -g nodemon

# install dependencies
ADD package.json /src/openhim-core/
WORKDIR /src/openhim-core/
RUN npm install

# add app
ADD . /src/openhim-core/

CMD npm run build && node lib/server.js