'use strict';

import { getJSON, putJSON, postJSON, getArrayBuffer } from '../lib/requests';
import { capitalize } from '../lib/utils';
import support from '../lib/support';
import ImagePromise from '../lib/imagepromise';

import Base from './base';

const isLoopback = (url) =>
    /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?(\/|$)/i.test(url);

const Server = Base.extend('LANDMARKER SERVER', function (url) {

    this.url = url;
    this.demoMode = false;
    this.version = 2;
    this.httpAuth = false;

    if (this.url === 'demo') {
        this.url = '';
        this.demoMode = true;
    } else if (!/^(?:f|ht)tps?\:\/\//.test(url)) {
        this.url = 'http://' + this.url;
    }

    this.httpAuth = url.indexOf('https://') === 0;

    // An https page may not talk to a plain http server (mixed content), except
    // to one on the same machine: browsers treat localhost as secure.
    if (!this.demoMode && support.https && this.url.indexOf('https://') !== 0 &&
        !isLoopback(this.url)) {
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

// Does the server learn from the saved landmarks and refine others (landmarkerio-server --fit)?
// Resolves with its status, rejects if there is no such service. The status is that of the
// default (first) model, and `models` has the status of each model by name.
Server.prototype.fetchFitStatus = function () {
    return this.fetchJSON('fit');
};

// The route of a fit request: for the model with that name, or for the default one without
const fitPath = (model, path) => model ?
    `fit/models/${encodeURIComponent(model)}/${path}` : `fit/${path}`;

// The landmarks that are on the asset (a landmark group's JSON), refined by a model of the
// server (`model` is its name, the default one without). With a box ([[min, min], [max, max]]
// in the order of the points) the fit starts from the model's initial shape in it, whatever
// the landmarks are.
Server.prototype.fitLandmarkGroup = function (id, type, json, box, model) {
    const path = model ? `fit/models/${encodeURIComponent(model)}/fit/${id}/${type}` :
                         `fit/${id}/${type}`;
    return postJSON(this.map(path), {
        data: box ? Object.assign({}, json, {box}) : json,
        auth: this.httpAuth
    });
};

// The box that the model would start from, to draw and let the annotator change
Server.prototype.fetchFitBox = function (id, model) {
    return getJSON(this.map(fitPath(model, `box/${id}`)), {auth: this.httpAuth});
};

// Learn from all the annotations again, as a background job (see fetchFitStatus)
Server.prototype.fitTrain = function (model) {
    return postJSON(this.map(fitPath(model, 'train')), {auth: this.httpAuth});
};

// Add one saved image to the model (only what is saved is learnt from), as a background job
Server.prototype.fitLearn = function (id, model) {
    return postJSON(this.map(fitPath(model, `learn/${id}`)), {auth: this.httpAuth});
};

// Learn from each image as it is saved, or not. Resolves with the new status
Server.prototype.fitSetLearnOnSave = function (enabled, model) {
    return postJSON(this.map(fitPath(model, 'learn_on_save')), {
        data: {enabled}, auth: this.httpAuth
    });
};

// The pre-fit: fit every image without saved landmarks and keep the results as proposals (what
// the landmarks of the image are until it is saved), as a background job (see fetchFitStatus).
// `overwrite`: fit again the images that already have a proposal from this model; `chain`:
// start each image from the one before it (the frames of a video)
Server.prototype.fitPredict = function (type, model, {overwrite=false, chain=false}={}) {
    return postJSON(this.map(fitPath(model, `predict/${type}`)), {
        data: {overwrite, chain}, auth: this.httpAuth
    });
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
