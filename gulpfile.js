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
        .pipe($.sass({ includePaths: pkg.paths.src.sass, outputStyle: pkg.opt.sass.output }).on("error", $.sass.logError))
        // display file/size
        .pipe($.size({ gzip: pkg.opt.size.gzipped, showFiles: pkg.opt.size.showfiles }))
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
        .pipe($.size({ gzip: pkg.opt.size.gzipped, showFiles: pkg.opt.size.showfiles }))
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
        // handle errors
        .pipe($.plumber({ errorHandler: onError }))
        // give pug access to development data
        .pipe($.data(function(file) { return require('./package.json'); }))
        // convert pug to html files
        .pipe($.pug({ pretty: pkg.opt.pug.pretty }))
        // display file/size
        .pipe($.size({ gzip: pkg.opt.size.gzipped, showFiles: pkg.opt.size.showfiles }))
        // put generated html files into dist folder
        .pipe(gulp.dest(pkg.paths.dist.base))
        // reload browsers
        .pipe(browserSync.stream());
});


// create inline-js task ???


// SRC/VENDOR JS -> DIST JS
gulp.task("js", () => {
    // state that we are building js
    $.fancyLog($.chalk.yellow("-> Building js"));
    // get js files from globs and/including temp folder
    return gulp.src(pkg.globs.js)
        // handle errors
        .pipe($.plumber({ errorHandler: onError }))
        // combine js files
        .pipe($.concat(pkg.vars.name.siteJs))
        // add banner
        .pipe($.header(banner, { pkg: pkg }))
        // display file/size
        .pipe($.size({ gzip: pkg.opt.size.gzipped, showFiles: pkg.opt.size.showfiles }))
        // put generated js into dist folder
        .pipe(gulp.dest(pkg.paths.dist.js))
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


// create pa11y accessability task ??


// PROCESS IMAGES
gulp.task("imagemin", () => {
    // state that we are processing images
    $.fancyLog($.chalk.yellow("-> Processing images"));
    // get image files from src
    return gulp.src(pkg.paths.src.img + "**/*.{png,jpg,jpeg,gif,svg}")
        // process images
        .pipe($.imagemin([
            // process gifs
          	$.imagemin.gifsicle({ interlaced: pkg.opt.imagemin.interlaced }),
            // process jpegs
          	$.imagemin.jpegtran({ progressive: pkg.opt.imagemin.progressive }),
            // process pngs
          	$.imagemin.optipng({ optimizationLevel: pkg.opt.imagemin.optimizationLevel }),
            // process svgs
          	$.imagemin.svgo({
                		plugins: [
                  			{ removeViewBox: pkg.opt.imagemin.svgoPlugins_removeVB },
                  			{ cleanupIDs: pkg.opt.imagemin.svgoPlugins_cleanupIDs }
                		]
              	})
          ]))
        // put processed images into dist folder
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
