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

Base.prototype.demoMode = false;
Base.prototype.version = 2;

module.exports = Base;
