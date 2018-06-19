// package vars
const pkg = require("./package.json");

// gulp
const gulp = require("gulp");

// load all plugins in "devDependencies" into the variable $
const $ = require("gulp-load-plugins")({
    pattern: ["*"],
    scope: ["devDependencies"]
});

const onError = (err) => {
    console.log(err);
};

const banner = [
    "/**",
    " * @project        <%= pkg.name %>",
    " * @author         <%= pkg.author %>",
    " * @build          " + $.moment().format("llll") + " ET",
    " * @copyright      Copyright (c) " + $.moment().format("YYYY") + ", <%= pkg.copyright %>",
    " *",
    " */",
    ""
].join("\n");


// sass - build the sass to the temp folder, including the required paths, and writing out a sourcemap
gulp.task("sass", () => {
    $.fancyLog($.chalk.yellow("-> Compiling sass"));
    return gulp.src(pkg.paths.src.sass + pkg.vars.name.sass)
        .pipe($.debug({title: 'sass:'}))
        .pipe($.plumber({errorHandler: onError}))
        .pipe($.sourcemaps.init({loadMaps: pkg.opt.sourcemaps.loadmaps}))
        .pipe($.cached("sass_compile"))
        .pipe($.sass({
                includePaths: pkg.paths.sass
            })
            .on("error", $.sass.logError))
        .pipe($.autoprefixer())
        .pipe($.sourcemaps.write("./"))
        .pipe($.size({gzip: pkg.opt.size.gzipped, showFiles: pkg.opt.size.showfiles}))
        .pipe(gulp.dest(pkg.paths.temp.css));
});

// css task - combine & minimize any distribution CSS into the dist css folder, and add our banner to it
gulp.task("css", ["sass"], () => {
    $.fancyLog($.chalk.yellow("-> Building css"));
    return gulp.src(pkg.globs.distCss)
        .pipe($.debug({title: 'css:'}))
        .pipe($.plumber({errorHandler: onError}))
        .pipe($.newer({dest: pkg.paths.dist.css + pkg.vars.name.siteCss}))
        .pipe($.print.default())
        .pipe($.sourcemaps.init({loadMaps: pkg.opt.sourcemaps.loadmaps}))
        .pipe($.concat(pkg.vars.name.siteCss))
        .pipe($.cssnano({
            discardComments: {removeAll: pkg.opt.cssnano.discardComments_removeAll},
            discardDuplicates: pkg.opt.cssnano.discardDuplicates,
            minifyFontValues: pkg.opt.cssnano.minifyFontValues,
            minifySelectors: pkg.opt.cssnano.minifySelectors
          }))
        .pipe($.header(banner, {pkg: pkg}))
        .pipe($.sourcemaps.write("./"))
        .pipe($.size({gzip: pkg.opt.size.gzipped, showFiles: pkg.opt.size.showfiles}))
        .pipe(gulp.dest(pkg.paths.dist.css))
        .pipe($.filter("**/*.css"))
        .pipe($.livereload());
});


gulp.task("pug", () => {
  $.fancyLog($.chalk.yellow("-> Building html"));
  return gulp.src(pkg.paths.src.pug + "**/*.pug")
    .pipe($.debug({title: 'pug:'}))
    .pipe($.pug({pretty: pkg.opt.pug.pretty}))
    .pipe(gulp.dest(pkg.paths.dist.base))
    .pipe($.filter("**/*.html"))
    .pipe($.livereload());
});

// inline js task - minimize the inline Javascript into _inlinejs in the templates path
gulp.task("js-inline", () => {
    $.fancyLog($.chalk.yellow("-> Copying inline js"));
    return gulp.src(pkg.globs.inlineJs)
        .pipe($.debug({title: 'jsinline:'}))
        .pipe($.plumber({errorHandler: onError}))
        .pipe($.if(["*.js", "!*.min.js"],
            $.newer({dest: pkg.paths.templates + "_inlinejs", ext: ".min.js"}),
            $.newer({dest: pkg.paths.templates + "_inlinejs"})
        ))
        .pipe($.if(["*.js", "!*.min.js"],
            $.rename({suffix: ".min"})
        ))
        .pipe($.size({gzip: pkg.opt.size.gzipped, showFiles: pkg.opt.size.showfiles}))
        .pipe(gulp.dest(pkg.paths.templates + "_inlinejs"))
        .pipe($.filter("**/*.js"))
        .pipe($.livereload());
});

// js task - minimize any distribution Javascript into the dist js folder, and add our banner to it
gulp.task("js", ["js-inline"], () => {
    $.fancyLog($.chalk.yellow("-> Building js"));
    return gulp.src(pkg.globs.distJs)
        .pipe($.debug({title: 'js:'}))
        .pipe($.plumber({errorHandler: onError}))
        .pipe($.if(["*.js", "!*.min.js"],
            $.newer({dest: pkg.paths.dist.js, ext: ".min.js"}),
            $.newer({dest: pkg.paths.dist.js})
        ))
        .pipe($.if(["*.js", "!*.min.js"],
            $.rename({suffix: ".min"})
        ))
        .pipe($.header(banner, {pkg: pkg}))
        .pipe($.size({gzip: pkg.opt.size.gzipped, showFiles: pkg.opt.size.showfiles}))
        .pipe(gulp.dest(pkg.paths.dist.js))
        .pipe($.filter("**/*.js"))
        .pipe($.livereload());
});

// Process data in an array synchronously, moving onto the n+1 item only after the nth item callback
function doSynchronousLoop(data, processData, done) {
    if (data.length > 0) {
        const loop = (data, i, processData, done) => {
            processData(data[i], i, () => {
                if (++i < data.length) {
                    loop(data, i, processData, done);
                } else {
                    done();
                }
            });
        };
        loop(data, 0, processData, done);
    } else {
        done();
    }
}

// Process the downloads one at a time
function processDownload(element, i, callback) {
    const downloadSrc = element.url;
    const downloadDest = element.dest;

    $.fancyLog("-> Downloading URL: " + $.chalk.cyan(downloadSrc) + " -> " + $.chalk.magenta(downloadDest));
    $.download(downloadSrc)
        .pipe(gulp.dest(downloadDest));
    callback();
}

// download task
gulp.task("download", (callback) => {
    doSynchronousLoop(pkg.globs.download, processDownload, () => {
        // all done
        callback();
    });
});

// Run pa11y accessibility tests on each template
function processAccessibility(element, i, callback) {
    const accessibilitySrc = pkg.urls.critical + element.url;
    const cliReporter = require('./node_modules/pa11y/reporter/cli.js');
    const options = {
        log: cliReporter,
        ignore:
                [
                    'notice',
                    'warning'
                ],
        };
    const test = $.pa11y(options);

    $.fancyLog($.chalk.yellow("-> Checking Accessibility for URL: ") + $.chalk.cyan(accessibilitySrc));
    test.run(accessibilitySrc, (error, results) => {
        cliReporter.results(results, accessibilitySrc);
        callback();
    });
}

// accessibility task
gulp.task("a11y", (callback) => {
    doSynchronousLoop(pkg.globs.critical, processAccessibility, () => {
        // all done
        callback();
    });
});

// imagemin task
gulp.task("imagemin", () => {
    return gulp.src(pkg.paths.src.img + "**/*.{png,jpg,jpeg,gif,svg}")
        .pipe($.imagemin([
          	$.imagemin.gifsicle({interlaced: pkg.opt.imagemin.interlaced}),
          	$.imagemin.jpegtran({progressive: pkg.opt.imagemin.progressive}),
          	$.imagemin.optipng({optimizationLevel: pkg.opt.imagemin.optimizationLevel}),
          	$.imagemin.svgo({
          		plugins: [
          			{removeViewBox: pkg.opt.imagemin.svgoPlugins_removeVB},
          			{cleanupIDs: pkg.opt.imagemin.svgoPlugins_cleanupIDs}
          		]
          	})
          ]))
        .pipe(gulp.dest(pkg.paths.dist.img));
});

// Default task
gulp.task("default", ["css", "js", "pug"], () => {
    $.livereload.listen();
    gulp.watch([pkg.paths.src.sass + "**/*.sass"], ["css"]);
    gulp.watch([pkg.paths.src.css + "**/*.css"], ["css"]);
    gulp.watch([pkg.paths.src.js + "**/*.js"], ["js"]);
    gulp.watch([pkg.paths.src.pug + "**/*.pug"], ["pug"]);
    gulp.watch([pkg.paths.dist.base + "**/*.{html,htm}"], () => {
        gulp.src(pkg.paths.dist.base + "**/*.{html,htm}")
            .pipe($.plumber({errorHandler: onError}))
            .pipe($.livereload());
    });
});

// Production build
gulp.task("build", ["download", "default", "imagemin"]);
