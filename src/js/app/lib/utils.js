"use strict";

module.exports = {};

module.exports.randomString = function (length, useTime=true) {
    var result = '',
        ch = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    for (var i = length; i > 0; --i) {
        result += ch[Math.round(Math.random() * (ch.length - 1))];
    }

    if (useTime) {
        return result + (new Date()).getTime();
    }

    return result;
}

module.exports.basename = function (path, removeExt=false) {
    let bn = path.split('/').pop();
    return removeExt ? bn.split('.').slice(0, -1).join('.') : bn;
}

module.exports.extname = function (path) {
    return path.toLowerCase().split('.').pop();
}

module.exports.stripTrailingSlash = function (str) {
    return str.substr(-1) === '/' ? str.substr(0, str.length - 1) : str;
}

module.exports.pad = function (n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n :
        new Array(width - n.length + 1).join(z) + n;
}
