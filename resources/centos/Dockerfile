FROM centos/systemd

LABEL Jembi Health Systems NPC

# install dependencies
RUN yum install -y gcc gcc-c++ \
  make cmake git \
  rpm-build redhat-rpm-config && \
  yum clean all

RUN curl -sL https://rpm.nodesource.com/setup_8.x | bash -
RUN yum install -y nodejs
RUN npm --version && node -v

WORKDIR /etc

# pull latest code from git
RUN git clone https://github.com/jembi/openhim-core-js.git
WORKDIR /etc/openhim-core-js

# link source code to rpmbuild folder
RUN ln -s /etc/openhim-core-js ~/rpmbuild

# Install existing dependencies and build
RUN npm i
RUN npm run build
