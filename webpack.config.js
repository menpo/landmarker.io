module.exports = {
    entry: "./src/js/index.js",
    output: {
        path: __dirname,
        filename: "bundle.js"
    },
    devtool: "source-map", // or "inline-source-map"
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
                loaders: ["style", "css?sourceMap", "resolve-url", "sass?sourceMap"]
            },
            {
                test: /\.svg$/,
                loader: 'file-loader'
            }
        ]
    }
};
