'use strict';

var gulp = require('gulp');
var gutil = require('gulp-util');
var webpack = require("webpack");
var WebpackDevServer = require("webpack-dev-server");
var webpackConfig = require("./webpack.config.js");
var del = require('del');

//var prefix = require('gulp-autoprefixer');
//var notify = require("gulp-notify");
//var manifest = require('gulp-manifest');
//var rev = require('gulp-rev');
//var buffer = require('gulp-buffer');
//var inject = require('gulp-inject');

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['webpack-dev-server']);

gulp.task('clean-dist', function (cb) {
    del(['./dist'], cb);
});

gulp.task('copystatic', ['clean-dist'], function(){
    return gulp.src(['static/**/*']).pipe(gulp.dest('dist'));
});

gulp.task("webpack-dev-server", ['copystatic'], function() {
    // modify some webpack config options
    var myConfig = Object.create(webpackConfig);
    myConfig.devtool = "eval";
    myConfig.debug = true;

    // Start a webpack-dev-server
    new WebpackDevServer(webpack(myConfig), {
        contentBase: "dist/",
        stats: {
            colors: true
        }
    }).listen(8080, "localhost", function(err) {
            if(err) {
                throw new gutil.PluginError("webpack-dev-server", err);
            }
            gutil.log("[webpack-dev-server]", "http://localhost:8080/webpack-dev-server/index.html");
        });
});

/*
var remoteCached = [
    '//fonts.googleapis.com/css?family=Roboto:400,300,300italic,400italic,500,500italic,700,700italic',
    '//cdnjs.cloudflare.com/ajax/libs/octicons/2.4.1/octicons.css'
];

gulp.task('manifest', function(){
    return gulp.src(buildGlobs, { base: '.' })
        .pipe(manifest({
            hash: true,
            cache: remoteCached,
            filename: 'lmio.appcache',
            exclude: 'lmio.appcache'
        }))
        .pipe(gulp.dest('.'))
        .pipe(notify('Landmarker.io: Manifest updated'));
});

gulp.task('html', function() {
    var target = gulp.src(entry.html);
    var sources = gulp.src(buildGlobs, {read: false});
    return target.pipe(inject(sources, {addRootSlash: false}))
        .pipe(gulp.dest('.'))
        .pipe(notify('Landmarker.io: HTML rebuilt'));

});

gulp.task('build-html', function() {
    runSequence('html', 'manifest');
});
*/
