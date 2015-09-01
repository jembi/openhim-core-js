How to do an OpenHIM-console release
====================================

This page describes the steps to follow to do an OpenHIM console release. Make sure you are on the master branch and it is fully up-to-date before beginning this process.

1. `npm version (major|minor|patch)` - choose one according to semver.
2. `git push origin master`
3. `git push origin vx.x.x` - push the tag that 2 created.
4. Run `grunt` then `tar cvzf openhim-console-vx.x.x.tar.gz -C dist/ .`
5. Create a new github release using the tag created in 3 above that includes the release notes and attach the tar.gz distribution created in 4.
6. Write a blog post on openhim.org that includes the release notes.
