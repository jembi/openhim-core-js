FROM centos

LABEL Jembi Health Systems NPC

# install dependencies
RUN yum install -y gcc gcc-c++ \
  make cmake git \
  rpm-build redhat-rpm-config && \
  yum clean all

RUN curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash
RUN source ~/.bashrc
RUN nvm install --lts
RUN npm --version && node -v
