"use strict";

var Promise = require('promise-polyfill');

module.exports = {};

module.exports.extend = function extend (child, parent) {

  if (typeof child !== 'function') {
    throw new TypeError(`${child} must be a function`);
  }

  if (typeof parent !== 'function') {
    throw new TypeError(`${parent} must be a function`);
  }

  child.prototype = Object.create(parent.prototype);
  child.prototype.constructor = child;
};

/**
 * Immediately Resolved Promise
 * Use to provide a Promise interface with no actual async behaviour
 */
module.exports.irp = function irp (data) {
    return new Promise(function (resolve) {
        resolve(data);
    });
};

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
