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

var Picker = require('../view/dropbox_picker.js');

var Dropbox = require('./base').extend(function Dropbox (token, cfg) {
    this._token = token;
    this._cfg = cfg;

    // Caches
    this._mediaCache = {};
    this._imgCache = {};
    this._listCache = {};

    // Save config data
    this._cfg.set('BACKEND_TYPE', Dropbox.Type);
    this._cfg.set('BACKEND_DROPBOX_TOKEN', token);
    this._cfg.save();
});

Dropbox.Type = 'DROPBOX';

Dropbox.Extensions = {
    Images: ['jpeg', 'jpg', 'png'],
    Meshes: ['obj', 'raw'],
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

    // Redirect to Dropbox authentication page
    return [u, oAuthState];
};

Dropbox.prototype.accountInfo = function () {
    return getJSON('https://api.dropbox.com/1/account/info', this.headers());
};

Dropbox.prototype.headers = function () {
    if (!this._token) {
        throw new Error("Can't proceed without an access token");
    }
    return { "Authorization": `Bearer ${this._token}`};
};

Dropbox.prototype.pickTemplate = function (success, error, closable=false) {
    let picker = new Picker({
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
         this.templates = {};
         this.templates[basename(path, true)] = tmpl;

        this._cfg.set({
            'BACKEND_DROPBOX_TEMPLATE_PATH': path,
            'BACKEND_DROPBOX_TEMPLATE_CONTENT': tmpl.toJSON(),
        }, true);
    });
};

Dropbox.prototype.pickAssets = function (success, error, closable=false) {
    let picker = new Picker({
        dropbox: this,
        selectFoldersOnly: true,
        title: 'Select a directory from which to load assets',
        closable,
        submit: (path) => {
            this.setAssets(path).then(() => {
                picker.dispose();
                success(path);
            }, error);
        }
    });

    picker.open();
    return picker;
};

Dropbox.prototype.setAssets = function (path) {

    if (!path) {
        return Promise.resolve(null);
    }

    this._assetsPath = path;

    return this.list(path, {
        filesOnly: true,
        extensions: Dropbox.Extensions.Images
    }).then((items) => {
        this._assets = items.map(function (item) {
            return item.path;
        });

        this._cfg.set({
            'BACKEND_DROPBOX_ASSETS_PATH': this._assetsPath
        }, true);
    });
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
            `https://api.dropbox.com/1/metadata/auto${path}`,
            this.headers(),
            {list: true}
        ).then((data) => {
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

Dropbox.prototype.download = function (path) {
    return get(
        `https://api-content.dropbox.com/1/files/auto${path}`,
        this.headers()
    ).then((data) => {
        return data;
    }, (err) => {
        throw err;
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
        `https://api.dropbox.com/1/media/auto${path}`,
        this.headers()
    ).then(({url, expires}) => {
        this._mediaCache[path] = {url, expires: new Date(expires)};
        return url;
    });

    this._mediaCache[path] = q;
    return q;
};

Dropbox.prototype.fetchMode = function () {
    return Promise.resolve('image');
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

Dropbox.prototype.fetchImg = function (assetId) {

    if (this._imgCache[assetId]) {
        return this._imgCache[assetId];
    }

    let q = this.mediaURL(`${this._assetsPath}/${assetId}`).then((url) => {
        return ImagePromise(url).then((data) => {
            delete this._imgCache[assetId];
            return data;
        }, (err) => {
            delete this._imgCache[assetId];
            throw err;
        });
    });

    this._imgCache[assetId] = q;
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
            resolve(this.templates[type].emptyLJSON(2));
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
