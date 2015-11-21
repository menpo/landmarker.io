var webpackConfig = require("./webpack.base.config.js");
webpackConfig.devtool = "eval-source-map";
webpackConfig.debug = true;

module.exports = webpackConfig;
