var gulp = require('gulp');
var prefix = require('gulp-autoprefixer');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var notify = require("gulp-notify");
var manifest = require('gulp-manifest');
var runSequence = require('run-sequence');
var exorcist = require('exorcist');

var paths = {
    js: ['src/js/**/*.js'],
    css: ['src/css/**/*.css']
};

var build_dir = '.';

var built = [
    './bundle*js',
    './index.html',
    './css/*.css',
    './img/*.png'
];

gulp.task('manifest', function(){
    return gulp.src(built, { base: build_dir })
        .pipe(manifest({
            hash: true,
            filename: 'lmio.appcache',
            exclude: 'lmio.appcache'
        }))
        .pipe(gulp.dest(build_dir))
        .pipe(notify('Landmarker.io: Manifest updated'));
});

// Rebuild the JS bundle + issue a notification when done.
gulp.task('js', function() {
    return browserify('./src/js/index.js')
        .bundle({ debug: true })
        // Cut out the source map...
        .pipe(exorcist('bundle.js.map'))
        // Pass desired output filename to vinyl-source-stream
        .pipe(source('bundle.js'))
        // Start piping stream to tasks!
        .pipe(gulp.dest('.'))
        //
        // Ideally we would now like to minify the bundle, whilst keeping the
        // source mapping correct. I can't get this working for now, so we
        // just ignore it.
        //.pipe(streamify(uglify()))
        //.pipe(rename('bundle.min.js'))
        //.pipe(gulp.dest('.'))
        .pipe(notify('Landmarker.io: JS rebuilt'));
});

// Rebuild the CSS autoprefixer output + issue a notification when done.
gulp.task('css', function() {
    return gulp.src(paths.css)
        .pipe(prefix(["last 1 version", "> 1%", "ie 8", "ie 7"],
            { cascade: true }))
        .pipe(gulp.dest('./css/'))
        .pipe(notify('Landmarker.io: CSS rebuilt'));
});

// Rerun the task when a file changes
gulp.task('watch', function() {
    console.log(paths.js);
    gulp.watch(paths.js, ['js']);
    gulp.watch(paths.css, ['css']);
});

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['watch', 'js', 'css']);
