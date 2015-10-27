'use strict';

var gulp = require('gulp');
var gutil = require('gulp-util');
var webpack = require("webpack");
var WebpackDevServer = require("webpack-dev-server");
var webpackConfig = require("./webpack.config.js");
var del = require('del');
var manifest = require('gulp-manifest');
var replace = require('gulp-replace');
var path = require('path');

var remoteCached = [
    '//fonts.googleapis.com/css?family=Roboto:400,300,300italic,400italic,500,500italic,700,700italic',
    '//cdnjs.cloudflare.com/ajax/libs/octicons/2.4.1/octicons.css'
];

var BUILD_DIR = './build';

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['webpack-dev-server']);

gulp.task('clean', function (cb) {
    del([BUILD_DIR], cb);
});

gulp.task('copystatic', ['clean'], function(){
    return gulp.src(['static/**/*']).pipe(gulp.dest(BUILD_DIR));
});

gulp.task("webpack-dev-server", ['copystatic'], function() {
    // modify some webpack config options
    var myConfig = Object.create(webpackConfig);
    myConfig.devtool = "eval";
    myConfig.debug = true;

    // Start a webpack-dev-server
    new WebpackDevServer(webpack(myConfig), {
        contentBase: BUILD_DIR,
        stats: {
            colors: true
        }
    }).listen(8080, "localhost", function(err) {
            if(err) {
                throw new gutil.PluginError("webpack-dev-server", err);
            }
            gutil.log("[webpack-dev-server]", "http://localhost:8080/webpack-dev-server/");
        });
});

gulp.task("webpack", ['copystatic'], function(callback) {
    // modify some webpack config options
    var myConfig = Object.create(webpackConfig);
    myConfig.plugins = myConfig.plugins.concat(
        new webpack.DefinePlugin({
            "process.env": {
                // This has effect on the react lib size
                "NODE_ENV": JSON.stringify("production")
            }
        }),
        new webpack.optimize.DedupePlugin(),
        new webpack.optimize.UglifyJsPlugin()
    );

    // run webpack
    webpack(myConfig, function(err, stats) {
        if(err) throw new gutil.PluginError("webpack", err);
        gutil.log("[webpack:build]", stats.toString({
            colors: true
        }));
        callback();
    });
});


gulp.task('create-manifest', ['webpack'], function(){
    return gulp.src(['./build/bundle.js'], { base: BUILD_DIR })
        .pipe(manifest({
            hash: true,
            cache: remoteCached,
            filename: 'lmio.appcache',
            exclude: 'lmio.appcache'
        }))
        .pipe(gulp.dest(BUILD_DIR));
});

gulp.task('manifest', ['create-manifest'], function() {
    var index_path = path.join(BUILD_DIR, 'index.html');
    return gulp.src([index_path])
        .pipe(replace('<html lang="en">', '<html lang="en" manifest="lmio.appcache">'))
        .pipe(gulp.dest(BUILD_DIR));
});


gulp.task('build-html', function() {
    runSequence('html', 'manifest');
});

