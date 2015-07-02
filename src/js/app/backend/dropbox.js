/**
 * Dropbox backend interface
 *
 * Until https://github.com/dropbox/dropbox-js/pull/183/ gets merged and
 * related issues are fixed, dropbox-js doesn't work with browserify, given the
 * small subset of api endpoint we use, we roll our own http interface for now.
 *
 * Be aware that a new version of the API is in the works as well:
 * https://www.dropbox.com/developers-preview/documentation/http#documentation
 * and we might want to upgrade once it is production ready.
 */
"use strict";

var API_KEY = "jwda9p0msmkfora";

var url = require('url'),
    Promise = require('promise-polyfill');

var { randomString, basename, extname } = require('../lib/utils');

var { getJSON, get, putJSON } = require('../lib/requests'),
    ImagePromise = require('../lib/imagepromise'),
    Template = require('../model/template');

var Dropbox = require('./base').extend(function Dropbox (token, cfg) {
    this._token = token;
    this._cfg = cfg;
    this._templates = {};

    this._media = {};
    this._assetsRequests = {};

    this._cfg.set('BACKEND_TYPE', Dropbox.Type);
    this._cfg.set('BACKEND_DROPBOX_TOKEN', token);
    this._cfg.save();
});

Dropbox.Type = 'DROPBOX';

Dropbox.TemplateParsers = {
    'yaml': Template.parseYAML,
    'yml': Template.parseYAML,
    'json': Template.parseJSON,
    'ljson': Template.parseLJSON
};

Dropbox.AssetExtensions = ['jpeg', 'jpg', 'png'];

/**
 * Builds an authentication URL for Dropbox OAuth2 flow and
 * redirects the user
 * @param  {string} stateString [to be sent back and verified]
 */
Dropbox.authorize = function () {
    // Persist authentication status and data for page reload
    var oAuthState = randomString(100);

    let u = url.format({
        protocol: 'https',
        host: 'www.dropbox.com',
        pathname: '/1/oauth2/authorize',
        query: { 'response_type': 'token',
                 'redirect_uri': window.location.origin,
                 'state': oAuthState,
                 'client_id': API_KEY }
    });

    // Redirect to Dropbox authentication page
    return [u, oAuthState];
};

Dropbox.prototype.headers = function () {
    if (!this._token) {
        throw new Error("Can't proceed without an access token");
    }
    return { "Authorization": `Bearer ${this._token}`};
};

Dropbox.prototype.loadTemplate = function (path) {

    if (!path) {
        return Promise.resolve(null);
    }

    this._templates = {};

    let ext = extname(path);
    if (!(ext in Dropbox.TemplateParsers)) {
        return Promise.resolve(null);
    }

    return this.download(path).then((data) => {
         let tmpl = Dropbox.TemplateParsers[ext](data);
         this._templates[basename(path, true)] = tmpl;

        this._cfg.set({
            'BACKEND_DROPBOX_TEMPLATE': path,
            'BACKEND_DROPBOX_TEMPLATE_DATA': tmpl.toJSON(),
        }, true);
    });
};

Dropbox.prototype.setAssets = function (path) {

    if (!path) {
        return Promise.resolve(null);
    }

    this._assetsPath = path;

    return this.list(path, {
        filesOnly: true,
        extensions: Dropbox.AssetExtensions
    }).then((items) => {
        this._assets = items.map(function (item) {
            return item.path;
        });

        this._cfg.set({
            'BACKEND_DROPBOX_ASSETS_PATH': this._assetsPath
        }, true);
    });
}

Dropbox.prototype.accountInfo = function () {
    return getJSON(
        'https://api.dropbox.com/1/account/info', this.headers());
};

Dropbox.prototype.list = function (path='/', {
    foldersOnly=false,
    filesOnly=false,
    showHidden=false,
    extensions=[]
}={}) {
    let opts = {list: true};

    return getJSON(
        `https://api.dropbox.com/1/metadata/auto/${path}`, this.headers(), opts
    ).then((data) => {

        if (!data.is_dir) {
            throw new Error(`${path} is not a directory`);
        }

        return data.contents.filter(function (item) {

            if (!showHidden && basename(item.path).charAt(0) === '.') {
                return false;
            }

            if (!item.is_dir) {
                if (foldersOnly) {
                    return false;
                }

                if (
                    extensions.length > 0 && extensions.indexOf(extname(item.path)) === -1
                ) {
                    return false;
                }

            }

            if (filesOnly && item.is_dir) {
                return false;
            }

            return true;
        });
    });
};

Dropbox.prototype.download = function (path) {
    return get(
        `https://api-content.dropbox.com/1/files/auto${path}`,
        this.headers()
    ).then((data) => {
        return data;
    }, (err) => {
        console.log('DL Error', err);
    });
};

Dropbox.prototype.mediaURL = function (path, noCache) {

    if (this._media[path] instanceof Promise) {
        return this._media[path];
    }

    if (noCache) {
        delete this._media[path];
    } else if (path in this._media) {

        let {expires, url} = this._media[path];

        if (expires > new Date()) {
            return Promise.resolve(url);
        }
    }

    let q = getJSON(
        `https://api.dropbox.com/1/media/auto${path}`,
        this.headers()
    ).then(({url, expires}) => {
        this._media[path] = {url, expires: new Date(expires)};
        return url;
    });

    this._media[path] = q;
    return q;


};

Dropbox.prototype.fetchMode = function () {
    return Promise.resolve('image');
};

Dropbox.prototype.fetchTemplates = function () {
    return Promise.resolve(Object.keys(this._templates));
};

Dropbox.prototype.fetchCollections = function () {
    return Promise.resolve(['all']);
};

Dropbox.prototype.fetchCollection = function () {
    return Promise.resolve(this._assets.map(function (assetPath) {
        return basename(assetPath, false);
    }));
}

Dropbox.prototype.fetchImg = function (assetId) {

    if (this._assetsRequests[assetId]) {
        return this._assetsRequests[assetId];
    }

    let q = this.mediaURL(`${this._assetsPath}/${assetId}`).then((url) => {
        return ImagePromise(url).then((data) => {
            delete this._assetsRequests[assetId];
            return data;
        }, (err) => {
            delete this._assetsRequests[assetId];
            throw err;
        });
    });

    this._assetsRequests[assetId] = q;
    return q;
}

Dropbox.prototype.fetchThumbnail = Dropbox.prototype.fetchImg;
Dropbox.prototype.fetchTexture = Dropbox.prototype.fetchImg;

Dropbox.prototype.fetchLandmarkGroup = function (id, type) {

    let path = `${this._assetsPath}/landmarks/${id}_${type}.ljson`;

    return new Promise((resolve, reject) => {
        this.download(path).then((data) => {
            resolve(JSON.parse(data));
        }, () => {
            resolve(this._templates[type].emptyLJSON(2));
        });
    });
}

Dropbox.prototype.saveLandmarkGroup = function (id, type, json) {
    let headers = this.headers();

    let path = `${this._assetsPath}/landmarks/${id}_${type}.ljson`;

    return putJSON(
        `https://api-content.dropbox.com/1/files_put/auto${path}`,
        json,
        headers
    );
}

module.exports = Dropbox;
