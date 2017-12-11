FROM node:8
ARG branch

WORKDIR /etc

# Update apt-repo list and install prerequisits
RUN apt-get update
RUN apt-get install -y git
RUN apt-get install -y bzip2

# Clone Openhim-console repo
RUN git clone https://github.com/jembi/openhim-core-js.git

WORKDIR /etc/openhim-core-js

RUN git checkout -b $branch origin/$branch

# Install dependencies and build
RUN npm i
RUN npm run build

# Run server
CMD ["npm", "start"]
