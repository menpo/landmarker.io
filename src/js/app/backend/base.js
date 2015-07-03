"use strict";

function Base () {}

// Abstract prototype methods
[
    'fetchMode',
    'fetchTemplates',
    'fetchCollections',
    'fetchCollection',
    'fetchLandmarkGroup',
    'saveLandmarkGroup',
    'fetchThumbnail',
    'fetchTexture',
    'fetchGeometry',
].forEach(function (name) {
    Base.prototype[name] = function () {
        throw new Error(`${name} instance method not implemented`);
    }
});

Base.extend = function extend (child) {
  child.prototype = Object.create(Base.prototype);
  child.prototype.constructor = child;
  return child;
};

module.exports = Base;
