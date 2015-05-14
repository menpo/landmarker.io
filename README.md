landmarker.io
=============

3D mesh and image annotation in the browser.



Getting set up for development
==============================

The landmarker.io client uses NPM for all dependencies. As a prerequisite, you'll need node.js and NPM installed on your system. With these set up, just `cd` to the top landmarker.io directory and run:

```
> npm install
```

This may take some time as all dependencies are installed.

We use [gulp](http://gulpjs.com/) for handling the build of the code. You'll probably want that installed as a global command line tool:

```
> [sudo] npm install -g gulp
```
You may need the sudo depending on your node installation.

Now you are all set. Run
``` 
> gulp
````
in the top directory. Any changes to the files will trigger a rebuild by gulp, so you can just edit the JS and reload the page to see the changes.

Note that you edit the individual modules in `src/js` - gulp compiles these all together using [browserify](http://browserify.org) and produces a monolithic JS file called `bundle-SOMEHASH.js`. When debugging in your browser, source maps hide this from you, so you'll be able to place breakpoints and step through code as it looks on disk, not the compiled moonlithic file.

See  [landmarkerio-server](https://github.com/menpo/landmarkerio-server) for
installation instructions for the server.


### Landmark JSON format

Landmarks are served as JSON payloads. See 

https://github.com/menpo/landmarker.io/blob/master/api/v2/landmarks/james/ibug68.json

for an example of this format.
