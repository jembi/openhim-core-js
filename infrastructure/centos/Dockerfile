FROM centos

LABEL Jembi Health Systems NPC

# install dependencies
CMD yum -y update && \
  yum install -y git rpm-build redhat-rpm-config gcc-c++ make && \
  # Install nvm and nodejs
  curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash && \
  source ~/.bashrc && \
  nvm install --lts && \
  npm --version && node -v && \
  git clone https://github.com/jembi/openhim-core-js.git && \
  cd openhim-core-js/ && \
  npm install && npm install speculate && npm run build && \
  # generate SPEC file for rpmbuild
  npm run spec && \
  # Link source folder with default rpmbuild
  ln -s /openhim-core-js ~/rpmbuild && \
  # Build rpm package
  rpmbuild -bb ~/rpmbuild/SPECS/openhim-core.spec
