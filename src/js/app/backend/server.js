"use strict";

var DEFAULT_API_URL = 'http://localhost:5000';

var { getJSON, putJSON, getArrayBuffer } = require('../lib/requests'),
    ImagePromise = require('../lib/imagepromise');

var Server = require('./base').extend(function Server (url) {
    this.url = url || DEFAULT_API_URL;
    this.demoMode = false;
    this.version = 2;

    if (this.url === 'demo') {
        this.url = '';
        this.demoMode = true;
    }
});

Server.Type = 'LANDMARKER SERVER';

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
    return getJSON(url);
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
    return getJSON(this.map(`landmarks/${id}/${type}`));
}

Server.prototype.saveLandmarkGroup = function (id, type, json) {
    return putJSON(this.map(`landmarks/${id}/${type}`), json);
}

Server.prototype.fetchThumbnail = function (assetId) {
    return ImagePromise(this.map(`thumbnails/${assetId}`));
}

Server.prototype.fetchTexture = function (assetId) {
    return ImagePromise(this.map(`textures/${assetId}`));
}

Server.prototype.fetchGeometry = function (assetId) {
    return getArrayBuffer(this.map(`meshes/${assetId}`));
}

Server.prototype.testV1 = function (fail) {
    this.version = 1;
    this.fetchMode().then(() => {
        console.log('v1 server found - redirecting to legacy landmarker');
        // we want to add v1 into the url and leave everything else the same
        var url = require('url');
        var u = url.parse(window.location.href, true);
        u.pathname = '/v1/';
        window.location.replace(url.format(u));
    }, fail);
}

module.exports = Server;
