How to do an OpenHIM-console release
====================================

This page describes the steps to follow to do an OpenHIM console release. Make sure you are on the master branch and it is fully up-to-date before beginning this process.  Additionally, ensure that the version of OpenHIM core compatible with this release of OpenHIM console has already been pushed to GitHub.

1. `npm version (major|minor|patch)` - choose one according to semver. (Use this command, i.e. don't bump manually)
2. `git push origin master`
3. `git push origin vx.x.x` - push the tag that 2 created.
4. Run `npm run prepare` then `tar cvzf openhim-console-vx.x.x.tar.gz -C dist/ .`
5. Create a new github release using the tag created in 3 above that includes the release notes and attach the tar.gz distribution created in 4.
6. Build a debian package and upload it to launchpad. Follow the [instructions here](https://github.com/jembi/openhim-console/tree/master/packaging).
7. Build a rpm package, follow the [instructions here](http://openhim.readthedocs.io/en/latest/how-to/how-to-build-and-test-rpm-package.html).
