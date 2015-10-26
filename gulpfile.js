'use strict';

var gulp = require('gulp');
var gutil = require('gulp-util');
var prefix = require('gulp-autoprefixer');
var browserify = require('browserify');
var babelify = require('babelify');
var watchify = require('watchify');
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

var PRODUCTION = process.env.NODE_ENV === 'production';
console.log(PRODUCTION ? 'PRODUCTION: true' : 'PRODUCTION: false');

var src = {
    scss: ['src/scss/**/*.scss'],
    html: ['src/index.html']
};

var entry = {
    js: './src/js/index.js',
    scss: './src/scss/main.scss',
    html: './src/index.html'
};

var buildGlobs = [
    './bundle*js',
    './index.html',
    './bundle*.css',
    './img/*'
];

var remoteCached = [
    '//fonts.googleapis.com/css?family=Roboto:400,300,300italic,400italic,500,500italic,700,700italic',
    '//cdnjs.cloudflare.com/ajax/libs/octicons/2.4.1/octicons.css'
];

var browserifyOpts = {
    entries: [entry.js],
    transform: [babelify],
    debug: true
};

var opts = Object.assign({}, watchify.args, browserifyOpts);
var b = watchify(browserify(opts));

function processJS() {
    var buildJS = b.bundle()
        .on('error', function (err) {
            if (PRODUCTION) {
                throw err;
            } else {
                gutil.log('Browserify Error', err.message || err);
            }
        })
        .pipe(source('bundle.js'))
        .pipe(buffer())
        .pipe(rev())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('.'))
        .pipe(notify('Landmarker.io: JS rebuilt'));
}

// Rebuild the SASS and pass through autoprefixer output
// + issue a notification when done.
function processSASS() {
    var buildSASS = gulp.src(entry.scss)
        .pipe(sourcemaps.init())
        .pipe(sass()
        .on('error', function (err) {
            if (PRODUCTION) {
                throw err;
            } else {
                gutil.log('Node-Sass Error', err.message || err);
            }
        }))
        .pipe(prefix(["last 1 version", "> 1%", "ie 8", "ie 7"],
            { cascade: true }))
        .pipe(sourcemaps.write())
        .pipe(rename('bundle.css'))
        .pipe(buffer())
        .pipe(rev())
        .pipe(gulp.dest('.'))
        .pipe(notify('Landmarker.io: SASS (CSS) rebuilt'));
}

function processHTML() {
    var target = gulp.src(entry.html);
    var sources = gulp.src(buildGlobs, {read: false});
    return target.pipe(inject(sources, {addRootSlash: false}))
        .pipe(gulp.dest('.'))
        .pipe(notify('Landmarker.io: HTML rebuilt'));
}

function processManifest() {
    return gulp.src(buildGlobs, { base: '.' })
        .pipe(manifest({
            hash: true,
            cache: remoteCached,
            filename: 'lmio.appcache',
            exclude: 'lmio.appcache'
        }))
        .pipe(gulp.dest('.'))
        .pipe(notify('Landmarker.io: Manifest updated'));
}

gulp.task('sass', processSASS);
gulp.task('html', processHTML);
gulp.task('js', processJS);
gulp.task('manifest', processManifest);

gulp.task('clean-js', function (cb) {
    del(['./bundle*.js*'], cb);
});

gulp.task('clean-css', function (cb) {
    del(['./bundle*.css*'], cb);
});

gulp.task('build-js', function() {
    runSequence('clean-js', 'js', 'build-html');
});

gulp.task('build-css', function() {
    runSequence('clean-css', 'sass', 'build-html');
});

gulp.task('build-html', function() {
    console.log('starting to build HTML');
    runSequence('html', 'manifest');
});

// Rerun the task when a file changes
gulp.task('watch', function() {
    gulp.watch(src.scss, ['build-css']);
    gulp.watch(src.html, ['build-html']);
});

// on JS updates, rebundle the JS/html/manifest.
b.on('update', function() { console.log('update firing'); gulp.run('build-js') });

gulp.task('build', ['build-js', 'build-css']);

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['watch', 'build-js', 'build-css']);
