FROM centos as init

LABEL Jembi Health Systems NPC

# install dependencies
RUN yum install -y gcc gcc-c++ vim \
  make cmake git \
  pkgconfig rpm-build redhat-rpm-config && \
  yum clean all

RUN curl -sL https://rpm.nodesource.com/setup_8.x | sudo bash -
RUN yum install -y nodejs
RUN npm --version && node -v

WORKDIR /etc

# pull latest code from git
RUN git clone https://github.com/jembi/openhim-core-js.git
WORKDIR /etc/openhim-core-js

RUN npm install speculate

# Install existing dependencies and build
RUN npm i
RUN npm run build
