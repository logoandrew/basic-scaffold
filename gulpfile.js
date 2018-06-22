// package vars
const pkg = require("./package.json");

// gulp
const gulp = require("gulp");
const browserSync = require('browser-sync').create();

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


// SRC SASS -> TEMP CSS
gulp.task("sass", () => {
    // state that we are starting the sass task
    $.fancyLog($.chalk.yellow("-> Compiling sass"));
    // get main sass file from src folder
    return gulp.src(pkg.paths.src.sass + pkg.vars.name.sass)
        // handle errors
        .pipe($.plumber({ errorHandler: onError }))
        // convert sass to css
        .pipe($.sass({
                includePaths: pkg.paths.src.sass,
                outputStyle: pkg.opt.sass.output
            })
            .on("error", $.sass.logError))
        // display file/size
        .pipe($.size({
                gzip: pkg.opt.size.gzipped,
                showFiles: pkg.opt.size.showfiles
            }))
        // put generated css file in temp folder
        .pipe(gulp.dest(pkg.paths.temp.css));
});


// TEMP CSS -> DIST CSS
gulp.task("css", ["sass"], () => {
    // run sass task
    // state that we are starting the css task
    $.fancyLog($.chalk.yellow("-> Building css"));
    // get css files from globs and/including temp folder
    return gulp.src(pkg.globs.css)
        // handle errors
        .pipe($.plumber({ errorHandler: onError }))
        // display filenames
        .pipe($.print.default())
        // combine css files
        .pipe($.concat(pkg.vars.name.siteCss))
        // autoprefix
        .pipe($.autoprefixer())
        // minify if not in development
        .pipe($.if(!pkg.devMode, $.cssnano({
                discardComments: { removeAll: pkg.opt.cssnano.discardComments_removeAll },
                discardDuplicates: pkg.opt.cssnano.discardDuplicates,
                minifyFontValues: pkg.opt.cssnano.minifyFontValues,
                minifySelectors: pkg.opt.cssnano.minifySelectors
            })))
        // add banner
        .pipe($.header(banner, { pkg: pkg }))
        // display file/size
        .pipe($.size({
                gzip: pkg.opt.size.gzipped,
                showFiles: pkg.opt.size.showfiles
            }))
        // put updated css file in dist folder
        .pipe(gulp.dest(pkg.paths.dist.css))
        // reload browsers
        .pipe(browserSync.stream());
});


// PUG -> HTML
gulp.task("pug", () => {
    // state that we are building html
    $.fancyLog($.chalk.yellow("-> Building html"));
    // get pug files from src folder
    return gulp.src(pkg.paths.src.pug + "**/*.pug")
        // give pug access to development data
        .pipe($.data(function(file) {
                return require('./package.json');
            }))
        // convert pug to html files
        .pipe($.pug({ pretty: pkg.opt.pug.pretty }))
        // put generated html files into dist folder
        .pipe(gulp.dest(pkg.paths.dist.base))
        // if any html files change then... ?-necessary?
        .pipe($.filter("**/*.html"))
        // reload browsers
        .pipe(browserSync.stream());
});


// inline js task - minimize the inline Javascript into _inlinejs in the templates path
gulp.task("js-inline", () => {
    $.fancyLog($.chalk.yellow("-> Copying inline js"));
    return gulp.src(pkg.globs.inlineJs)
        .pipe($.debug({ title: '! jsinline:' }))
        .pipe($.plumber({ errorHandler: onError }))
        .pipe($.if(["*.js", "!*.min.js"],
            $.newer({ dest: pkg.paths.templates + "_inlinejs", ext: ".min.js" }),
            $.newer({ dest: pkg.paths.templates + "_inlinejs" })
        ))
        .pipe($.if(["*.js", "!*.min.js"],
            $.rename({ suffix: ".min" })
        ))
        .pipe($.size({ gzip: pkg.opt.size.gzipped, showFiles: pkg.opt.size.showfiles }))
        .pipe(gulp.dest(pkg.paths.templates + "_inlinejs"))
        .pipe($.filter("**/*.js"))
        // reload browsers
        .pipe(browserSync.stream());
});


// js task - minimize any distribution Javascript into the dist js folder, and add our banner to it
gulp.task("js", ["js-inline"], () => {
    $.fancyLog($.chalk.yellow("-> Building js"));
    return gulp.src(pkg.globs.js)
        .pipe($.debug({ title: '! js:' }))
        .pipe($.plumber({ errorHandler: onError }))
        .pipe($.if(["*.js", "!*.min.js"],
            $.newer({ dest: pkg.paths.dist.js, ext: ".min.js" }),
            $.newer({ dest: pkg.paths.dist.js })
        ))
        .pipe($.if(["*.js", "!*.min.js"],
            $.rename({ suffix: ".min" })
        ))
        .pipe($.header(banner, { pkg: pkg }))
        .pipe($.size({ gzip: pkg.opt.size.gzipped, showFiles: pkg.opt.size.showfiles }))
        .pipe(gulp.dest(pkg.paths.dist.js))
        .pipe($.filter("**/*.js"))
        // reload browsers
        .pipe(browserSync.stream());
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
          	$.imagemin.gifsicle({ interlaced: pkg.opt.imagemin.interlaced }),
          	$.imagemin.jpegtran({ progressive: pkg.opt.imagemin.progressive }),
          	$.imagemin.optipng({ optimizationLevel: pkg.opt.imagemin.optimizationLevel }),
          	$.imagemin.svgo({
          		plugins: [
          			{ removeViewBox: pkg.opt.imagemin.svgoPlugins_removeVB },
          			{ cleanupIDs: pkg.opt.imagemin.svgoPlugins_cleanupIDs }
          		]
          	})
          ]))
        .pipe(gulp.dest(pkg.paths.dist.img));
});


// Default task
gulp.task("default", ["css", "js", "pug"], () => {
    browserSync.init({
        server: "./dist"
    });
    gulp.watch([pkg.paths.src.sass + "**/*.sass"], ["css"]);
    gulp.watch([pkg.paths.src.css + "**/*.css"], ["css"]);
    gulp.watch([pkg.paths.src.js + "**/*.js"], ["js"]);
    gulp.watch([pkg.paths.src.pug + "**/*.pug"], ["pug"]);
    gulp.watch([pkg.paths.dist.base + "**/*.{html,htm}"])
        .on('change', browserSync.reload);
});


// Production build
gulp.task("build", ["download", "default", "imagemin"]);
