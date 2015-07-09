"use strict";

module.exports = {};

const randomString = function (length, useTime=true) {
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

const basename = function (path, removeExt=false) {
    let bn = path.split('/').pop();
    return removeExt ? bn.split('.').slice(0, -1).join('.') : bn;
}

const extname = function (path) {
    const parts = path.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : undefined;
}

const stripExtension = function (path) {
    const parts = path.split('.');
    return parts.length > 1 ? parts.slice(0, -1).join('.') : path;
}

const stripTrailingSlash = function (str) {
    return str.substr(-1) === '/' ? str.substr(0, str.length - 1) : str;
}

const addTrailingSlash = function (str) {
    return str.substr(-1) === '/' ? str : str + '/';
}

const baseUrl = function () {
    return addTrailingSlash(window.location.origin + window.location.pathname);
}

const pad = function (n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n :
        new Array(width - n.length + 1).join(z) + n;
}

const capitalize = function (str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

module.exports = {
    randomString,
    basename, extname, stripExtension,
    stripTrailingSlash, addTrailingSlash,
    baseUrl,
    capitalize, pad,
}
