"use strict";

var DEFAULT_API_URL = 'http://localhost:5000';

var extend = require('../lib/oop').extend;
var { JSONGetPromise } = require('../lib/requests');

var Base = require('./base');

function Server (url=DEFAULT_API_URL) {
    this.url = url;
    this.version = 2;
    this.demoMode = false;
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

Server.prototype.fetchJSON = function (basepath, parsed) {
    let url = this.map(basepath);
    return JSONGetPromise(url);
}

function _capitalize (str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

[['mode'], ['templates'], ['collections']].forEach(function ([path, parsed]) {
    Server.prototype[`fetch${_capitalize(path)}`] = function (resolve, reject) {
        return this.fetchJSON(path, parsed, resolve, reject);
    }
});

Server.prototype.fetchLandmarkGroup = function (id, type) {
    return JSONGetPromise(this.map(`landmarks/${id}/${type}`));
}

module.exports = Server;
