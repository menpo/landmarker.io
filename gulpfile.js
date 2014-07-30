var gulp = require('gulp');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var notify = require("gulp-notify");

var paths = {
    js: ['js/**/*.js']
};

// Rebuild the JS bundle + issue a notification when done.
gulp.task('js', function() {
    return browserify('./js/index.js')
        .bundle({ debug: true })
        //Pass desired output filename to vinyl-source-stream
        .pipe(source('bundle.js'))
        // Start piping stream to tasks!
        .pipe(gulp.dest('.'))
        .pipe(notify('Landmarker.io: JS rebuilt'));
});

// Rerun the task when a file changes
gulp.task('watch', function() {
    console.log(paths.js);
    gulp.watch(paths.js, ['js']);
});

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['watch', 'js']);
