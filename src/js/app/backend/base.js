'use strict';

export default function Base () {}

// Abstract prototype methods
const abstractMethods = [
    'fetchMode',
      'fetchTemplates',
      'fetchCollections',
      'fetchCollection',
      'fetchLandmarkGroup',
      'saveLandmarkGroup',
      'fetchThumbnail',
      'fetchTexture',
      'fetchGeometry'
];

abstractMethods.forEach(function (name) {
    Base.prototype[name] = function () {
        throw new Error(`${name} instance method not implemented`);
    };
});

Base.extend = function extend (type, child) {
  child.prototype = Object.create(Base.prototype);
  child.prototype.constructor = child;
  child.Type = type;
  return child;
};
