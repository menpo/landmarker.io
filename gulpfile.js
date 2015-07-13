'use strict';

var gulp = require('gulp');
var gutil = require('gulp-util');
var prefix = require('gulp-autoprefixer');
var browserify = require('browserify');
var babelify = require('babelify');
var source = require('vinyl-source-stream');
var notify = require("gulp-notify");
var manifest = require('gulp-manifest');
var runSequence = require('run-sequence');
var rev = require('gulp-rev');
var buffer = require('gulp-buffer');
var inject = require('gulp-inject');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var rename = require('gulp-rename');
var del = require('del');
var uglify = require('gulp-uglify');

var src = {
    js: ['src/js/**/*.js'],
    scss: ['src/scss/**/*.scss'],
    index: ['src/index.html']
};

var entry = {
    js: './src/js/index.js',
    scss: './src/scss/main.scss'
};

var buildGlobs = [
    './bundle*js',
    './index.html',
    './bundle*.css',
    './img/*.png'
];

gulp.task('manifest', function(){
    return gulp.src(buildGlobs, { base: '.' })
        .pipe(manifest({
            hash: true,
            filename: 'lmio.appcache',
            exclude: 'lmio.appcache'
        }))
        .pipe(gulp.dest('.'))
        .pipe(notify('Landmarker.io: Manifest updated'));
});

gulp.task('clean-js', function (cb) {
    del(['./bundle*.js*'], cb);
});

gulp.task('clean-css', function (cb) {
    del(['./bundle*.css*'], cb);
});

// Rebuild the JS bundle + issue a notification when done.
gulp.task('js', function() {
    var b = browserify(entry.js, {debug: true, transform: [babelify]})
        .bundle();
    var pipeline = (
        b.on('error', function (err) {
            if (process.env.NODE_ENV === 'production') {
                throw err;
            } else {
                gutil.log('Browserify Error', err);
            }
        })
        .pipe(source('bundle.js'))
        .pipe(buffer())
        .pipe(rev())
        .pipe(sourcemaps.init({loadMaps: true}))
    );

    if (process.env.NODE_ENV === 'production') {
        pipeline = pipeline.pipe(uglify());
    }

    return pipeline
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('.'))
        .pipe(notify('Landmarker.io: JS rebuilt'));
});

// Rebuild the SCSS and pass throuhg autoprefixer output
// + issue a notification when done.
gulp.task('sass', function () {
    return gulp.src(entry.scss)
        .pipe(sourcemaps.init())
        .pipe(sass()
        .on('error', function (err) {
            if (process.env.NODE_ENV === 'production') {
                throw err;
            } else {
                gutil.log('Node-Sass Error', err);
            }
        }))
        .pipe(prefix(["last 1 version", "> 1%", "ie 8", "ie 7"],
            { cascade: true }))
        .pipe(sourcemaps.write())
        .pipe(rename('bundle.css'))
        .pipe(rev())
        .pipe(gulp.dest('.'))
        .pipe(notify('Landmarker.io: (S)CSS rebuilt'));
});

gulp.task('html', function() {
    var target = gulp.src('./src/index.html');
    var sources = gulp.src(buildGlobs, {read: false});
    return target.pipe(inject(sources, {addRootSlash: false}))
        .pipe(gulp.dest('.'))
        .pipe(notify('Landmarker.io: HTML rebuilt'));

});

gulp.task('build-js', function() {
    runSequence('clean-js', 'js', 'build-html');
});

gulp.task('build-css', function() {
    runSequence('clean-css', 'sass', 'build-html');
});

gulp.task('build-html', function() {
    runSequence('html', 'manifest');
});

// Rerun the task when a file changes
gulp.task('watch', function() {
    gulp.watch(src.js, ['build-js']);
    gulp.watch(src.scss, ['build-css']);
    gulp.watch(src.html, ['build-html']);
    // whenever any built file changes, invalidate the manifest
});

gulp.task('build', ['build-js', 'build-css']);

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['watch', 'build-js', 'build-css']);
