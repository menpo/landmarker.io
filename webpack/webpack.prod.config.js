var webpack = require("webpack");
var AppCachePlugin = require('appcache-webpack-plugin');
var webpackConfig = require("./webpack.base.config.js");

var REMOTE_CACHED = [
    '//fonts.googleapis.com/css?family=Roboto:400,300,300italic,400italic,500,500italic,700,700italic',
    '//cdnjs.cloudflare.com/ajax/libs/octicons/2.4.1/octicons.css'
];

// in production we use relative paths so staging builds work properly.
// (we can't do this for dev as relative paths seem to not play well
// with webpack-dev-server)
webpackConfig.output.publicPath = './';

webpackConfig.devtool = "source-map";  // full separate source maps
webpackConfig.bail = true;  // at any error just fallover
webpackConfig.plugins = webpackConfig.plugins.concat(
    new webpack.DefinePlugin({
        "process.env": {
            // This has effect on the react lib size
            "NODE_ENV": JSON.stringify("production")
        }
    }),
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.UglifyJsPlugin(),
    new AppCachePlugin({
        cache: REMOTE_CACHED.concat('index.html'),
        output: 'lmio.appcache'
    })
);

module.exports = webpackConfig;
