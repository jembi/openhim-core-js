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
  # Generate openhim-core rpm package
  git clone https://github.com/jembi/openhim-core-js.git && \
  cd openhim-core-js/ && \
  npm install && npm install speculate && npm run build && \
  # generate SPEC file for rpmbuild
  npm run spec && \
  # Link source folder with default rpmbuild
  ln -s /openhim-core-js ~/rpmbuild && \
  # Build rpm package
  rpmbuild -bb ~/rpmbuild/SPECS/openhim-core.spec && \
  # Generate openhim-console rpm package
  cd / && rm -rf ~/rpmbuild && git clone https://github.com/jembi/openhim-console.git && \
  cd openhim-console/ && \
  npm install && npm install speculate && \
  # generate SPEC file for rpmbuild
  npm run spec && \
  # Link source folder with default rpmbuild
  ln -s /openhim-console ~/rpmbuild && \
  # Build rpm package
  rpmbuild -bb ~/rpmbuild/SPECS/openhim-console.spec
