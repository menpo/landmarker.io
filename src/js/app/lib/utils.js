"use strict";

module.exports = {};

module.exports.randomString = function (length) {
    var result = '',
        ch = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    for (var i = length; i > 0; --i) {
        result += ch[Math.round(Math.random() * (ch.length - 1))];
    }

    return result;
}

module.exports.basename = function (path, removeExt=false) {
    let bn = path.split('/').pop();
    return removeExt ? bn.split('.').shift() : bn;
}

module.exports.extname = function (path) {
    return path.toLowerCase().split('.').pop();
}

module.exports.stripTrailingSlash = function (str) {
    return str.substr(-1) === '/' ? str.substr(0, str.length - 1) : str;
}
