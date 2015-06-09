"use strict";

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
