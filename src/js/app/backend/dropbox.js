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

const API_KEY = "jwda9p0msmkfora",
      API_URL = "https://api.dropbox.com/1",
      CONTENTS_URL = "https://api-content.dropbox.com/1";

const OBJLoader = require('../lib/obj_loader');

var url = require('url'),
    Promise = require('promise-polyfill');

var { randomString,
      basename,
      extname,
      stripExtension } = require('../lib/utils');

var { getJSON, get, putJSON } = require('../lib/requests'),
    ImagePromise = require('../lib/imagepromise'),
    Template = require('../model/template');

var Picker = require('../view/dropbox_picker.js');

var Dropbox = require('./base').extend('DROPBOX', function (token, cfg) {
    this._token = token;
    this._cfg = cfg;
    this.mode = 'image';
    this._meshTextures = {};

    // Caches
    this._mediaCache = {};
    this._imgCache = {};
    this._listCache = {};

    // Save config data
    this._cfg.set('BACKEND_TYPE', Dropbox.Type);
    this._cfg.set('BACKEND_DROPBOX_TOKEN', token);
    this._cfg.save();
});

Dropbox.Extensions = {
    image: ['jpeg', 'jpg', 'png'],
    mesh: ['obj', 'jpg', 'jpeg', 'png'],
}

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

    return [u, oAuthState];
};

Dropbox.prototype.headers = function () {
    if (!this._token) {
        throw new Error("Can't proceed without an access token");
    }
    return {"Authorization": `Bearer ${this._token}`};
};

Dropbox.prototype.accountInfo = function () {
    return getJSON(`${API_URL}/account/info`, {headers: this.headers()});
};

Dropbox.prototype.setMode = function (mode) {
    if (mode in Dropbox.Extensions) {
        this.mode = mode;
    } else {
        this.mode = this.mode || 'image';
    }
    this._cfg.set({'BACKEND_DROPBOX_MODE': this.mode}, true);
};

Dropbox.prototype.pickTemplate = function (success, error, closable=false) {
    const picker = new Picker({
        dropbox: this,
        selectFilesOnly: true,
        extensions: Object.keys(Template.Parsers),
        title: 'Select a template yaml file to use (you can also use an already annotated asset)',
        closable,
        submit: (tmplPath) => {
            this.setTemplate(tmplPath).then(() => {
                picker.dispose();
                success(this.templates);
            }, error);
        }
    });

    picker.open();
    return picker;
};

Dropbox.prototype.setTemplate = function (path, json) {

    if (!path) {
        return Promise.resolve(null);
    }

    let ext = extname(path);
    if (!(ext in Template.Parsers)) {
        return Promise.reject(
            new Error(`Incorrect extension ${ext} for template`)
        );
    }

    let q;

    if (json) {
        q = Promise.resolve(json);
    } else {
        q = this.download(path);
    }

    return q.then((data) => {
         let tmpl = Template.Parsers[ext](data);
         let name = basename(path, true).split('_').pop();
         this.templates = {};
         this.templates[name] = tmpl;

        this._cfg.set({
            'BACKEND_DROPBOX_TEMPLATE_PATH': path,
            'BACKEND_DROPBOX_TEMPLATE_CONTENT': tmpl.toJSON(),
        }, true);
    });
};

Dropbox.prototype.pickAssets = function (success, error, closable=false) {
    const picker = new Picker({
        dropbox: this,
        selectFoldersOnly: true,
        title: 'Select a directory from which to load assets',
        radios: [{
            name: 'mode',
            options: [['Image Mode', 'image'], ['Mesh Mode', 'mesh']]
        }],
        closable,
        submit: (path, isFolder, {mode}) => {
            this.setAssets(path, mode).then(() => {
                picker.dispose();
                success(path);
            }, error);
        }
    });

    picker.open();
    return picker;
};

Dropbox.prototype.setAssets = function (path, mode) {

    if (!path) {
        return Promise.resolve(null);
    }

    this._assetsPath = path;
    this.setMode(mode);

    return this.list(path, {
        filesOnly: true,
        extensions: Dropbox.Extensions[this.mode],
        noCache: true
    }).then((items) => {
        this._assets = [];
        this._meshTextures = {};
        if (this.mode === 'image') {
            this._setImageAssets(items);
        } else if (this.mode === 'mesh') {
            this._setMeshAssets(items);
        }

        this._cfg.set({'BACKEND_DROPBOX_ASSETS_PATH': this._assetsPath}, true);
    });
};

Dropbox.prototype._setMeshAssets = function (items) {
    const paths = items.map((item) => item.path);

    // Find only OBJ files
    this._assets = paths.filter((p) => extname(p) === 'obj');

    // Initialize texture map
    this._assets.forEach((p) => {
        this._meshTextures[p] = paths.indexOf(stripExtension(p) + '.jpg') > -1;
    });
};

Dropbox.prototype._setImageAssets = function (items) {
    this._assets = items.map((item) => item.path);
};

Dropbox.prototype.list = function (path='/', {
    foldersOnly=false,
    filesOnly=false,
    showHidden=false,
    extensions=[],
    noCache=false
}={}) {
    let q;

    if (this._listCache[path] && !noCache) {
        q = Promise.resolve(this._listCache[path]);
    } else {
        q = getJSON(
            `${API_URL}/metadata/auto${path}`, {
            headers: this.headers(),
            data: {list: true}
        }).then((data) => {
            this._listCache[path] = data;
            return data;
        });
    }

    return q.then((data) => {

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

Dropbox.prototype.download = function (path, responseType='text') {
    return get(
        `${CONTENTS_URL}/files/auto${path}`, {
        headers: this.headers(),
        responseType
    });
};

Dropbox.prototype.mediaURL = function (path, noCache) {

    if (this._mediaCache[path] instanceof Promise) {
        return this._mediaCache[path];
    }

    if (noCache) {
        delete this._mediaCache[path];
    } else if (path in this._mediaCache) {

        let {expires, url} = this._mediaCache[path];

        if (expires > new Date()) {
            return Promise.resolve(url);
        }
    }

    let q = getJSON(
        `${API_URL}/media/auto${path}`, {
        headers: this.headers()
    }).then(({url, expires}) => {
        this._mediaCache[path] = {url, expires: new Date(expires)};
        return url;
    });

    this._mediaCache[path] = q;
    return q;
};

Dropbox.prototype.fetchMode = function () {
    return Promise.resolve(this.mode);
};

Dropbox.prototype.fetchTemplates = function () {
    return Promise.resolve(Object.keys(this.templates));
};

Dropbox.prototype.fetchCollections = function () {
    return Promise.resolve([this._assetsPath]);
};

Dropbox.prototype.fetchCollection = function () {
    return Promise.resolve(this._assets.map(function (assetPath) {
        return basename(assetPath, false);
    }));
}

Dropbox.prototype.fetchImg = function (path) {

    if (this._imgCache[path]) {
        return this._imgCache[path];
    }

    let q = this.mediaURL(path).then((url) => {
        return ImagePromise(url).then((data) => {
            delete this._imgCache[path];
            return data;
        }, (err) => {
            console.log('Failded to fetch img', path);
            delete this._imgCache[path];
            throw err;
        });
    });

    this._imgCache[path] = q;
    return q;
}

Dropbox.prototype.fetchThumbnail = function () {
    return Promise.reject(null);
};

Dropbox.prototype.fetchTexture = function (assetId) {
    const path = `${this._assetsPath}/${assetId}`;
    if (this.mode === 'mesh') {
        if (this._meshTextures[path]) {
            return this.fetchImg(stripExtension(path) + '.jpg');
        } else {
            return Promise.reject(null);
        }
    } else {
        return this.fetchImg(path);
    }
};

Dropbox.prototype.fetchGeometry = function (assetId) {

    const path = `${this._assetsPath}/${assetId}`;

    const dl = this.download(path);
    const geometry = dl.then((data) => {
        return OBJLoader(data);
    });

    geometry.xhr = () => dl.xhr(); // compatibility
    geometry.isGeometry = true;
    return geometry;
}

Dropbox.prototype.fetchLandmarkGroup = function (id, type) {

    const path = `${this._assetsPath}/landmarks/${id}_${type}.ljson`;
    const dim = this.mode === 'mesh' ? 3 : 2;
    return new Promise((resolve, reject) => {
        this.download(path).then((data) => {
            resolve(JSON.parse(data));
        }, () => {
            resolve(this.templates[type].emptyLJSON(dim));
        });
    });
}

Dropbox.prototype.saveLandmarkGroup = function (id, type, json) {
    let headers = this.headers(),
        path = `${this._assetsPath}/landmarks/${id}_${type}.ljson`;

    return putJSON(
        `${CONTENTS_URL}/files_put/auto${path}`, {data: json, headers});
}

module.exports = Dropbox;
