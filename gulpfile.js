var gulp = require('gulp');
var prefix = require('gulp-autoprefixer');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var notify = require("gulp-notify");
var gzip = require('gulp-gzip');

var paths = {
    js: ['src/js/**/*.js'],
    css: ['src/css/**/*.css']
};

// Rebuild the JS bundle + issue a notification when done.
gulp.task('js', function() {
    return browserify('./src/js/index.js')
        .bundle({ debug: true })
        //Pass desired output filename to vinyl-source-stream
        .pipe(source('bundle.js'))
        .pipe(gzip())
        // Start piping stream to tasks!
        .pipe(gulp.dest('.'))
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
