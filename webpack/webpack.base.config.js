var path = require('path');

module.exports = {
    entry: "./src/js/index.js",
    output: {
        path: path.join(path.dirname(__dirname), 'build'),
        filename: "bundle.js"
    },
    module: {
        loaders: [
            {
                test: /\.jsx?$/,
                exclude: /(node_modules|bower_components)/,
                loader: 'babel'
            },
            {
                test: /\.json$/,
                loader: "json"
            },
            {
                test: /\.scss$/,
                loaders: ["style", "css?sourceMap", "resolve-url", "sass?sourceMap", "autoprefixer"]
            },
            {
                test: /\.(png|jpg|svg)$/,
                loader: 'url?limit=8192'  // inline base64 URLs for <=8k images, direct URLs for the rest
            }
        ]
    },
    plugins: []
};
