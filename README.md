<p align="center">
  <img src="./static/favicon-194x194.png" alt="landmarker.io"></center>
  <br><br>
  <a href="https://travis-ci.org/menpo/landmarker.io"><img src="https://travis-ci.org/menpo/landmarker.io.svg?branch=master" alt="Build Status"/></a>
</p>

landmarker.io
=============
3D mesh and image annotation in the browser, the app is live at [https://www.landmarker.io](https://www.landmarker.io).

Check out [the wiki](https://github.com/menpo/landmarker.io/wiki) for [usage instructions](https://github.com/menpo/landmarker.io/wiki/User-guide) and specifications. Read on if you want to contribute.

Found an issue, want to suggest an improvement: head over to the [issue tracker](https://github.com/menpo/landmarker.io/issues). You can reach out to us through [@teammenpo](https://twitter.com/@teammenpo), or if you have a more involved question and you don't know where to take it, try posting to our [mailing list](menpo-users@googlegroups.com):  [menpo-users@googlegroups.com](mailt:menpo-users@googlegroups.com).

See [landmarkerio-server](https://github.com/menpo/landmarkerio-server) for
installation instructions for the server.

## Getting set up for development

The landmarker.io client uses NPM for all dependencies. As a prerequisite, you'll need node.js and NPM installed on your system. With these set up, just `cd` to the top landmarker.io directory and run:

```
> npm install
```

This may take some time as all dependencies are installed.

We use [gulp](http://gulpjs.com/) for handling the build of the code. You'll probably want that installed as a global command line tool (you may need the sudo depending on your node installation):

```
> [sudo] npm install -g gulp
```

To start working, run

```
> gulp
```

from the project's root directory. This will create an `index.html` file as well as `bundle-xxxx.js` and `bundle-xxxx.css` (and respective source maps) at the root, and update them anytime a source file changes. All other files necessary for serving are already at the root, so you just need to have a static server run. `npm run serve` will server on [http://localhost:4000](http://localhost:4000) through [http-server](https://www.npmjs.com/package/http-server))

Alternatively you can use

```
> npm run watch
```

for the same effect without requiring gulp to be installed globally, and

```
> npm run build
```

will perform a one-off build ready for deployment.

### Javascript considerations

All javascript files are passed through [the babel compiler](https://babeljs.io/) so you can write valid ES2015 code. All code is bundled with [browserify](http://browserify.org/).

You can run `npm run lint` to run the [eslint](http://eslint.org/) tool on the code with our settings. The rules listed on the left hand side of the output are explained [here](http://eslint.org/docs/rules/). Errors should be fixed otherwise the travis build will fail.

Testing is not there yet. We have some tests and coverage with istanbul and mocha, but nothing extensive project-wide.

### CSS considerations

We use [SCSS](http://sass-lang.com/) for styles. There are currently no particular requirements other than putting all variables in `src/scss/_variables.scss` and importing module in the entrypoint `src/scss/main.scss`. Try and keep module at a reasonable size and make sure they contain related styles, don't hesitate to split them up.

## Notes on deployment

We use [Travis CI](https://travis-ci.org/menpo/landmarker.io/) for deployment.

`deploy.sh` is the script we run for our travis ci build. It simply builds the current branch and update the github pages branch to track the released version as well as staged versions. The deployment on Amazon S3 is done with [s3_website](https://github.com/laurilehmijoki/s3_website) by mirroring the content of this branch.

A release is done through a tag, which will update the root directory and clean the rolling history (only the last 3 deployed tags are kept). Any other branch (including master) is deployed at `/staging/branchname` and gets a link in `/staging/index.html`. We release by tagging master and pushing tags, this can be done with `npm version`. For example to release a minor version change:

```
> git checkout master
> npm version minor
> git push --tags
```

A changelog should be drafted on the [Github releases page](https://github.com/menpo/landmarker.io/releases) for the newly released version. Note that users have a link to this page from the version number on the intro screen, so release notes should be written in a user-friendly way (think how App Store release notes are done).
