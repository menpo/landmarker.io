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
