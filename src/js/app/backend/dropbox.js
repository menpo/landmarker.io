/**
 * Dropbox backend interface
 *
 * Until https://github.com/dropbox/dropbox-js/pull/183/ gets merged and
 * related issues are fixed, dropbox-js doesn't work with browserify, given the
 * small subset of api endpoint we use our own http interface for now.
 *
 */
"use strict";

var API_KEY = "zt5w1eymrntgmvo";

var Promise = require('promise-polyfill'),
    url = require('url');

var {extend, irp} = require('../lib/utils');
var { JSONPostPromise, JSONGetPromise } = require('../lib/requests');
var Base = require('./base');

function Dropbox () {
    this._token = undefined;
}

extend(Dropbox, Base);

Dropbox.version = 2;
Dropbox.demoMode = false;

Dropbox.prototype.fetchMode = function () {
    return irp('image');
};

/**
 * Builds an authentication URL for Dropbox OAuth2 flow and
 * redirects the user
 * @param  {string} stateString [to be sent back and verified]
 */
Dropbox.authorize = function (stateString) {
    let u = url.format({
        protocol: 'https',
        host: 'www.dropbox.com',
        pathname: '/1/oauth2/authorize',
        query: { 'response_type': 'token',
                 'redirect_uri': window.location.origin,
                 'state': stateString,
                 'client_id': API_KEY }
    });

    window.location = u;
};

Dropbox.prototype.setToken = function (token) {
    this._token = token;
};

Dropbox.prototype.getToken = function () {
    return this._token;
};

Dropbox.prototype.headers = function () {
    if (!this._token) {
        throw new Error("Can't proceed without an access token");
    }
    return { "Authorization": `Bearer ${this._token}`};
}

module.exports = Dropbox;
