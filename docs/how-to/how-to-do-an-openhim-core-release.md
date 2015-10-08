How to do an OpenHIM-core release
=================================

This page describes the steps to follow to do an OpenHIM release. Make sure you are on the `master` branch and it is fully up-to-date before beginning this process.

1. `npm shrinkwrap`
2. `git add npm-shrinkwrap.json`
3. `git commit -m"Added shrinkwrap for x.x.x release"` - replace x.x.x with the actual release version.
4. `npm version (major|minor|patch)` - choose one according to semver.
5. `npm publish`
6. `git rm npm-shrinkwrap.json`
7. `git commit -m"Removed shrinkwrap for continued development"`
8. `git push origin master`
9. `git push origin vx.x.x` - push the tag that 4 created.
10. Create a [new github release](https://github.com/jembi/openhim-core-js/releases/new) using the tag created in 4 above, that includes the release notes.
11. Build a debian package and upload it to launchpad. Follow the [instructions here](https://github.com/jembi/openhim-core-js/tree/master/packaging).
12. Write a blog post on [openhim.org](http://www.openhim.org/) that includes the release notes.

Support Releases
----------------

From time to time a support release may be required for critical security issues or bugs. When this happens, a support branch should be created in order to support that particular version.

If the branch doesn't exist, create it from the latest tag for a particular release:
* `git checkout -b support-vx.y vx.y.z`
else if the branch exists, simply check it out and continue from there
* `git checkout support-vx.y`

Ideally fixes should first be developed separately and merged into master. They can then be cherrypicked for the support release:
* `git cherry-pick bd68fe1c8cf81cbef2169414ce8440a7a2c69717`

Although this may not always be possible, in which case the fixes can be added manually.

The shrinkwrap can be left in place on a support branch. If however the support fixes include package updates, rerun the `npm shrinkwrap` command in order to update.

When all fixes have been applied, test thoroughly and create a new release as per normal:

4. `npm version (major|minor|patch)` - increment the patch version.
5. `npm publish`
8. `git push origin support-vx.y`
9. `git push origin vx.y.z` - push the new tag
10. Create a [new github release](https://github.com/jembi/openhim-core-js/releases/new)

When a particular version is no longer supported, its support branch should be deleted.
