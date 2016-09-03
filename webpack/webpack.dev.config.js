var webpackConfig = require("./webpack.base.config.js");
webpackConfig.devtool = "source-map";
webpackConfig.debug = true;
webpackConfig.output.publicPath = '/';

module.exports = webpackConfig;
