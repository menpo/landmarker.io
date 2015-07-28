'use strict';

import Config from '../model/config';

export function randomString (length, useTime=true) {
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

export function basename (path, removeExt=false) {
    const bn = path.split('/').pop();
    return removeExt ? bn.split('.').slice(0, -1).join('.') : bn;
}

export function extname (path) {
    const parts = path.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : undefined;
}

export function stripExtension (path) {
    const parts = path.split('.');
    return parts.length > 1 ? parts.slice(0, -1).join('.') : path;
}

export function stripTrailingSlash (str) {
    return str.substr(-1) === '/' ? str.substr(0, str.length - 1) : str;
}

export function addTrailingSlash (str) {
    return str.substr(-1) === '/' ? str : str + '/';
}

export function baseUrl () {
    return addTrailingSlash(window.location.origin + window.location.pathname);
}

export function pad (n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n :
        new Array(width - n.length + 1).join(z) + n;
}

export function capitalize (str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function maskedArray (array, mask) {
    const masked = [];
    for (let i = 0; i < mask.length; i++) {
        if (mask[i] !== undefined) {
            masked.push(array[mask[i]]);
        }
    }
    return masked;
}

export function restart (serverUrl) {
    Config().clear();
    const restartUrl = (
        baseUrl() + (serverUrl ? `?server=${serverUrl}` : '')
    );
    window.location.replace(restartUrl);
}
