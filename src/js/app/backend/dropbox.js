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

function Dropbox (token, assetsFolder) {
    this._token = token;
    this._assetsFolder = assetsFolder;
}

extend(Dropbox, Base);

Dropbox.TYPE = 'DROPBOX';

Dropbox.prototype.isReady = function () {
    return (this._token && this._assetsFolder);
}

Dropbox.prototype.landmarkPath = function (assetPath, type) {
    return `${assetPath}_landmarks_${type}.ljson`;
}

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
};

Dropbox.prototype.fetchMode = function () {
    return irp('image');
};

Dropbox.prototype.list = function (
    path='/', { foldersOnly=true, showHidden=false, extensions=[] }={}
) {
    let opts = {list: true};

    return JSONGetPromise(
        `https://api.dropbox.com/1/metadata/auto/${path}`, this.headers(), opts
    ).then((data) => {
        return data.contents.filter(function (item) {
            if (!showHidden &&
                item.path.split('/').pop().charAt(0) === '.'
            ) {
                return false;
            }

            if (foldersOnly && !item.is_dir) {
                return false;
            }

            if (extensions.length && !item.is_dir &&
                extensions.indexOf(item.path.split('.').pop()) === -1
            ) {
                return false;
            }

            return true;
        });
    });
};

module.exports = Dropbox;
