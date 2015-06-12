"use strict";

function Base () {}

// Abstract methods
[
    'fetchMode',
    'fetchTemplates',
    'fetchCollections',
    'fetchCollection',
    'fetchLandmarkGroup',
    'saveLandmarkGroup',
    'fetchThumbnail',
    'fetchTexture',
    'fetchGeometry'

].forEach(function (name) {
    Base.prototype[name] = function () {
        throw new Error(`${name} not implemented in implementation`);
    }
});

module.exports = Base;
