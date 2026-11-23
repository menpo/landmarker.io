import { defineConfig } from 'vite';

// The app is a static site: relative asset URLs let it be served from any path
// (the root of a domain, github.io/landmarker.io/, a staging folder...).
export default defineConfig({
    base: './',
    resolve: {
        alias: {
            // the code uses the `url` module of node (parse/format with a query);
            // the trailing slash picks the npm package rather than the node builtin
            url: 'url/',
            querystring: 'querystring/'
        }
    },
    css: {
        preprocessorOptions: {
            // the stylesheets use @import, which Dart Sass deprecates (it still works)
            scss: { quietDeps: true, silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'mixed-decls'] }
        }
    },
    build: {
        outDir: 'build',
        sourcemap: true,
        chunkSizeWarningLimit: 1200  // three.js is most of the bundle
    },
    test: {
        environment: 'node',
        include: ['test/**/*.js']
    }
});
