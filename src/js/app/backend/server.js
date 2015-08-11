'use strict';

import { getJSON, putJSON, getArrayBuffer } from '../lib/requests';
import { capitalize, prependHttp } from '../lib/utils';
import support from '../lib/support';
import ImagePromise from '../lib/imagepromise';

import Base from './base';

const Server = Base.extend('LANDMARKER SERVER', function (url) {

    this.url = url;
    this.demoMode = false;
    this.version = 2;
    this.httpAuth = false;

    if (this.url === 'demo') {
        this.url = '';
        this.demoMode = true;
    } else {
        this.url = prependHttp(this.url);
    }

    this.httpAuth = url.indexOf('https://') === 0;

    if (!this.demoMode && support.https && url.indexOf('https://') !== 0) {
        throw new Error('Mixed Content');
    }

});

export default Server;

Server.prototype.apiHeader = function () {
    return `/api/v${this.version}/`;
};

Server.prototype.map = function (url) {
    var mapping;
    if (this.demoMode) {
        // demoMode so we ignore the server url
        mapping = window.location.pathname.slice(0, -1) +
                  this.apiHeader() + url;
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
};

Server.prototype.fetchJSON = function (basepath) {
    const url = this.map(basepath);
    return getJSON(url, {auth: this.httpAuth});
};

['mode', 'templates', 'collections'].forEach(function (path) {
    const funcName = `fetch${capitalize(path)}`;
    Server.prototype[funcName] = function () {
        return this.fetchJSON(path);
    };
});

Server.prototype.fetchCollection = function (collectionId) {
    return this.fetchJSON(`collections/${collectionId}`);
};

Server.prototype.fetchLandmarkGroup = function (id, type) {
    return getJSON(this.map(`landmarks/${id}/${type}`), {auth: this.httpAuth});
};

Server.prototype.saveLandmarkGroup = function (id, type, json) {
    return putJSON(this.map(`landmarks/${id}/${type}`), {
        data: json,
        auth: this.httpAuth
    });
};

Server.prototype.fetchThumbnail = function (assetId) {
    return ImagePromise(this.map(`thumbnails/${assetId}`), this.httpAuth);
};

Server.prototype.fetchTexture = function (assetId) {
    return ImagePromise(this.map(`textures/${assetId}`), this.httpAuth);
};

Server.prototype.fetchGeometry = function (assetId) {
    return getArrayBuffer(this.map(`meshes/${assetId}`), {
        auth: this.httpAuth
    });
};
