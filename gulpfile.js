'use strict';

var path = require('path');
var del = require('del');

var gulp = require('gulp');
var replace = require('gulp-replace');
var gutil = require('gulp-util');

var webpack = require("webpack");
var WebpackDevServer = require("webpack-dev-server");
var AppCachePlugin = require('appcache-webpack-plugin');
var webpackConfig = require("./webpack.config.js");

var REMOTE_CACHED = [
    '//fonts.googleapis.com/css?family=Roboto:400,300,300italic,400italic,500,500italic,700,700italic',
    '//cdnjs.cloudflare.com/ajax/libs/octicons/2.4.1/octicons.css'
];

var BUILD_DIR = './build';

gulp.task('default', ['webpack-dev-server']);

gulp.task('clean', function (callback) {
    del([BUILD_DIR], callback);
});

gulp.task('copystatic', ['clean'], function(){
    return gulp.src(['static/**/*']).pipe(gulp.dest(BUILD_DIR));
});

gulp.task("webpack-dev-server", ['copystatic'], function() {
    // modify some webpack config options for development
    var devConfig = Object.create(webpackConfig);
    devConfig.devtool = "eval-source-map";
    devConfig.debug = true;

    // Start a webpack-dev-server
    new WebpackDevServer(webpack(devConfig), {
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

gulp.task("webpack:build", ['copystatic'], function(callback) {
    // modify some webpack config options
    var productionConfig = Object.create(webpackConfig);
    productionConfig.plugins = productionConfig.plugins.concat(
        new webpack.DefinePlugin({
            "process.env": {
                // This has effect on the react lib size
                "NODE_ENV": JSON.stringify("production")
            }
        }),
        new webpack.optimize.DedupePlugin(),
        new webpack.optimize.UglifyJsPlugin(),
        new AppCachePlugin({
            cache: REMOTE_CACHED.concat('index.html'),
            output: 'lmio.appcache'
        })
    );

    // run webpack
    webpack(productionConfig, function(err, stats) {
        if(err) throw new gutil.PluginError("webpack", err);
        gutil.log("[webpack:build]", stats.toString({
            colors: true
        }));
        callback();
    });
});

gulp.task('build', ['webpack:build'], function() {
    // after webpack has finished building, we just need to
    // enable the appcache in the built index.html
    var index_path = path.join(BUILD_DIR, 'index.html');
    return gulp.src([index_path])
        .pipe(replace('<html lang="en">', '<html lang="en" manifest="lmio.appcache">'))
        .pipe(gulp.dest(BUILD_DIR));
});

