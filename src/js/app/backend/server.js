"use strict";

var DEFAULT_API_URL = 'http://localhost:5000';

var extend = require('../lib/oop').extend,
    ImagePromise = require('../lib/imagepromise');

var { JSONGetPromise,
      JSONPutPromise,
      ArrayBufferGetPromise } = require('../lib/requests');

var Base = require('./base');

function Server (url) {
    this.url = url || DEFAULT_API_URL;
    this.version = 2;
    this.demoMode = false;

    if (this.url === 'demo') {
        this.url = '';
        this.demoMode = true;
    }
}

extend(Server, Base);

Server.prototype.apiHeader = function () {
    return `/api/v${this.version}/`;
}

Server.prototype.map = function (url) {
    var mapping;
    if (this.demoMode) {
        // demoMode so we ignore the server url
        mapping = (window.location.pathname.slice(0, -1) +
                   this.apiHeader() + url);
        // this just means we map everything to .json..except images
        // which have to be jpeg and mesh data (.raw)
        if ((new RegExp('textures/')).test(url)) {
            return mapping + '.jpg';
        } else if ((new RegExp('thumbnails/')).test(url)) {
            return mapping + '.jpg';
        } else if ((new RegExp('meshes/')).test(url)) {
            return mapping + '.raw';
        } else {
            return mapping + '.json';
        }
    } else {
        return this.url + this.apiHeader() + url;
    }
}

Server.prototype.fetchJSON = function (basepath) {
    let url = this.map(basepath);
    return JSONGetPromise(url);
}

function _capitalize (str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

['mode', 'templates', 'collections'].forEach(function (path) {
    let func = `fetch${_capitalize(path)}`;
    Server.prototype[func] = function () {
        return this.fetchJSON(path);
    }
});

Server.prototype.fetchCollection = function (collectionId) {
    return this.fetchJSON(`collections/${collectionId}`);
}

Server.prototype.fetchLandmarkGroup = function (id, type) {
    return JSONGetPromise(this.map(`landmarks/${id}/${type}`));
}

Server.prototype.saveLandmarkGroup = function (id, type, json) {
    return JSONPutPromise(this.map(`landmarks/${id}/${type}`), json);
}

Server.prototype.fetchThumbnail = function (assetId) {
    return ImagePromise(this.map(`thumbnails/${assetId}`));
}

Server.prototype.fetchTexture = function (assetId) {
    return ImagePromise(this.map(`textures/${assetId}`));
}

Server.prototype.fetchGeometry = function (assetId) {
    return ArrayBufferGetPromise(this.map(`meshes/${assetId}`));
}

module.exports = Server;
