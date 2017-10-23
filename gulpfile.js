var gulp = require('gulp');
var uglify = require('gulp-uglify');
var gulpSequence = require('gulp-sequence')
var pump = require('pump');
 
gulp.task('compress', function (cb) {
  pump([
        gulp.src('src/*.js'),
        uglify(),
        gulp.dest('dist')
    ],
    cb
  );
});

gulp.task('build', gulpSequence(['compress']));