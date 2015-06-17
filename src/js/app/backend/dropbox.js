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

var cfg = require('../model/config')();

var { extend, irp, randomString } = require('../lib/utils');
var { JSONPostPromise, JSONGetPromise } = require('../lib/requests');
var Base = require('./base');

function Dropbox (token) {
    this._token = token;
}

extend(Dropbox, Base);

Dropbox.TYPE = 'DROPBOX';

/**
 * Builds an authentication URL for Dropbox OAuth2 flow and
 * redirects the user
 * @param  {string} stateString [to be sent back and verified]
 */
Dropbox.authorize = function () {
    // Persist authentication status and data for page reload
    let stateString = randomString(100);
    cfg.set('OAuthState', stateString);
    cfg.set('storageEngine', Dropbox.TYPE);
    cfg.set('authenticated', false);
    cfg.save();

    let u = url.format({
        protocol: 'https',
        host: 'www.dropbox.com',
        pathname: '/1/oauth2/authorize',
        query: { 'response_type': 'token',
                 'redirect_uri': window.location.origin,
                 'state': stateString,
                 'client_id': API_KEY }
    });

    // Redirect to Dropbox authentication page
    window.location = u;
};

Dropbox.prototype.headers = function () {
    if (!this._token) {
        throw new Error("Can't proceed without an access token");
    }
    return { "Authorization": `Bearer ${this._token}`};
};

Dropbox.prototype.accountInfo = function () {
    return JSONGetPromise(
        'https://api.dropbox.com/1/account/info', this.headers());
}

Dropbox.prototype.fetchMode = function () {
    return irp('image');
};

module.exports = Dropbox;
