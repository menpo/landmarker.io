<p align="center">
  <img src="./public/favicon-194x194.png" alt="landmarker.io">
  <br><br>
  <a href="https://github.com/menpo/landmarker.io/actions/workflows/ci.yml"><img src="https://github.com/menpo/landmarker.io/actions/workflows/ci.yml/badge.svg" alt="CI"/></a>
</p>

landmarker.io
=============

3D mesh and image annotation in the browser. The app is a static site, hosted at
[https://menpo.github.io/landmarker.io/](https://menpo.github.io/landmarker.io/) (the old landmarker.io domain is gone).

* **Demo**: open [`?server=demo`](https://menpo.github.io/landmarker.io/?server=demo) to try it on a textured 3D head, with nothing to install.
* **Your own images or meshes**: the page keeps no data. A **server** that you run holds your assets and saves the landmarks next to them:

  ```
  pip install landmarkerio-server
  lmio image ./my_images          # or: lmio mesh ./my_meshes
  ```

  then open `https://menpo.github.io/landmarker.io/?server=http://localhost:5000`. The server is
  [landmarkerio-server](https://github.com/menpo/landmarkerio-server) (any server with the same `/api/v2/...` works).
  A page served over https may only talk to an https server, or to one on your own machine
  (`localhost`, `127.0.0.1`), which browsers allow; Chrome may ask you to let the page reach devices on your local network.

Check out [the wiki](https://github.com/menpo/landmarker.io/wiki) for [usage instructions](https://github.com/menpo/landmarker.io/wiki/User-guide) and specifications. Read on if you want to contribute.

Found an issue, want to suggest an improvement? Head over to the [issue tracker](https://github.com/menpo/landmarker.io/issues).

## Getting set up for development

You need Node.js 20 or newer. The app is built with [Vite](https://vite.dev) (it used to be webpack 1 and Babel 5, which no longer install).

```
> npm install
> npm run dev        # a dev server with live reload at http://localhost:5173
> npm test           # the unit tests (Vitest)
> npm run build      # the static site, in build/
> npm run preview    # serve build/ locally
```

### Javascript considerations

The code is ES modules, bundled as they are: use `import`, not `require`. Three.js is pinned to 0.94, which the
code was written for; upgrading it is a project of its own (`THREE.Geometry`, `ImageUtils` and the loaders changed).

### CSS considerations

We use [SCSS](http://sass-lang.com/) (compiled by Dart Sass) for styles. Put all variables in `src/scss/_variables.scss` and import modules in
the entrypoint `src/scss/main.scss`. Try and keep modules at a reasonable size and make sure they contain related styles.

## Deployment

`.github/workflows/ci.yml` runs the tests and the build for every pull request, and publishes `master` to GitHub Pages
(Settings, Pages, Source: GitHub Actions). The build uses relative URLs, so it works from any path.
