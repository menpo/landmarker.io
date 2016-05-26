var path = require('path');

module.exports = {
    entry: "./src/ts/index.ts",
    output: {
        path: path.join(path.dirname(__dirname), 'build'),
        filename: "bundle.js"
    },
    resolve: {
        // Add `.ts` and `.tsx` as a resolvable extension.
        extensions: ['', '.webpack.js', '.web.js', '.ts', '.tsx', '.js']
    },
    module: {
        loaders: [
            {
                test: /\.tsx?$/,
                exclude: /(node_modules|bower_components)/,
                loader: 'ts'
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
