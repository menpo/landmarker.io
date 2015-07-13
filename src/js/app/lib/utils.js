'use strict';

module.exports = {};

function randomString (length, useTime=true) {
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

function basename (path, removeExt=false) {
    const bn = path.split('/').pop();
    return removeExt ? bn.split('.').slice(0, -1).join('.') : bn;
}

function extname (path) {
    const parts = path.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : undefined;
}

function stripExtension (path) {
    const parts = path.split('.');
    return parts.length > 1 ? parts.slice(0, -1).join('.') : path;
}

function stripTrailingSlash (str) {
    return str.substr(-1) === '/' ? str.substr(0, str.length - 1) : str;
}

function addTrailingSlash (str) {
    return str.substr(-1) === '/' ? str : str + '/';
}

function baseUrl () {
    return addTrailingSlash(window.location.origin + window.location.pathname);
}

function pad (n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n :
        new Array(width - n.length + 1).join(z) + n;
}

function capitalize (str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
    randomString,
    basename, extname, stripExtension,
    stripTrailingSlash, addTrailingSlash,
    baseUrl,
    capitalize, pad
};
