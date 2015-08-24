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
'use strict';

const API_KEY = 'jwda9p0msmkfora',
      API_URL = 'https://api.dropbox.com/1',
      CONTENTS_URL = 'https://api-content.dropbox.com/1';

const IMAGE_EXTENSIONS = ['jpeg', 'jpg', 'png'];
const MESH_EXTENSIONS = ['obj', 'stl', 'mtl'].concat(IMAGE_EXTENSIONS);

import { format } from 'url';
import Promise from 'promise-polyfill';

import OBJLoader from '../lib/obj_loader';
import STLLoader from '../lib/stl_loader';
import { randomString,
      basename,
      extname,
      stripExtension,
      baseUrl } from '../lib/utils';
import download from '../lib/download';

import { notify } from '../view/notification';
import { getJSON, get, putJSON, getArrayBuffer } from '../lib/requests';
import ImagePromise from '../lib/imagepromise';
import Template from '../template';
import Picker from '../view/dropbox_picker.js';
import Base from './base';

const Dropbox = Base.extend('DROPBOX', function (token, cfg) {
    this._token = token;
    this._cfg = cfg;
    this.mode = 'image';
    this._meshTextures = {};
    this._meshMtls = {};

    // Caches
    this._mediaCache = {};
    this._imgCache = {};
    this._listCache = {};

    this._templates = Template.loadDefaultTemplates();
    this._templatesPaths = {};

    // Save config data
    this._cfg.set({
        'BACKEND_TYPE': Dropbox.Type,
        'BACKEND_DROPBOX_TOKEN': token
    }, true);
});

export default Dropbox;

// ============================================================================
// Dropbox specific code and setup functions
// ============================================================================

/**
 * Builds an authentication URL for Dropbox OAuth2 flow and
 * redirects the user
 * @param  {string} stateString [to be sent back and verified]
 */
Dropbox.authorize = function () {
    // Persist authentication status and data for page reload
    var oAuthState = randomString(100);

    const u = format({
        protocol: 'https',
        host: 'www.dropbox.com',
        pathname: '/1/oauth2/authorize',
        query: { 'response_type': 'token',
                 'redirect_uri': baseUrl(),
                 'state': oAuthState,
                 'client_id': API_KEY }
    });

    return [u, oAuthState];
};

/**
 * Return the base headers object to be passed to request,
 * only contains authorization -> extend from there
 * @return {Object}
 */
Dropbox.prototype.headers = function () {
    if (!this._token) {
        throw new Error(`Can't proceed without an access token`);
    }
    return {'Authorization': `Bearer ${this._token}`};
};

Dropbox.prototype.accountInfo = function () {
    return getJSON(`${API_URL}/account/info`, {headers: this.headers()});
};

Dropbox.prototype.setMode = function (mode) {
    if (mode === 'image' || mode === 'mesh') {
        this.mode = mode;
    } else {
        this.mode = this.mode || 'image';
    }
    this._cfg.set({'BACKEND_DROPBOX_MODE': this.mode}, true);
};

// Template management
// ---------------------------

/**
 * Open a dropbox picker to change the templates
 * @param  {function} success        called after successful call to addTemplate
 * @param  {function} error          called after failed call to addTemplate
 * @param  {bool}     closable=false should this modal be closable
 * @return {Modal}                   reference to the picker modal
 */
Dropbox.prototype.pickTemplate = function (success, error, closable=false) {
    const picker = new Picker({
        dropbox: this,
        selectFilesOnly: true,
        extensions: Object.keys(Template.Parsers),
        title: 'Select a template yaml file to use (you can also use an already annotated asset)',
        closable,
        submit: (tmplPath) => {
            this.addTemplate(tmplPath).then(() => {
                picker.dispose();
                success();
            }, error);
        }
    });

    picker.open();
    return picker;
};

/**
 * Downloads the file at path and adds tries to generate a template from it.
 * Rejects on download error or parsing error
 * @param {String} path
 * @return {Promise}
 */
Dropbox.prototype.addTemplate = function (path) {

    if (!path) {
        return Promise.reject(null);
    }

    const ext = extname(path);
    if (!(ext in Template.Parsers)) {
        return Promise.reject(
            new Error(`Incorrect extension ${ext} for template`)
        );
    }

    return this.download(path).then((data) => {
         const tmpl = Template.Parsers[ext](data);
         const name = basename(path, true).split('_').pop();

         // Avoid duplicates
         let uniqueName = name, i = 1;
         while (uniqueName in this._templates) {
             uniqueName = `${name}-${i}`;
             i++;
         }

         this._templates[uniqueName] = tmpl;
         this._templatesPaths[uniqueName] = path;

        this._cfg.set({
            'BACKEND_DROPBOX_TEMPLATES_PATHS': this._templatesPaths
        }, true);

        return name;
    });
};

/**
 * Starts a local download of the givem template as YAML
 */
Dropbox.prototype.downloadTemplate = function (name) {
    if (this._templates[name]) {
        download(this._templates[name].toYAML(), `${name}.yaml`, 'yaml');
    }
};

// Assets management
// ---------------------------

Dropbox.prototype.pickAssets = function (success, error, closable=false) {
    const picker = new Picker({
        dropbox: this,
        selectFoldersOnly: true,
        title: 'Select a directory from which to load assets',
        radios: [{
            name: 'mode',
            options: [
                ['Image Mode', 'image'],
                ['Mesh Mode', 'mesh']
            ]
        }],
        presets: {
            radios: [this.mode],
            root: this._assetsPath
        },
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

    const exts = this.mode === 'mesh' ? MESH_EXTENSIONS : IMAGE_EXTENSIONS;

    return this.list(path, {
        filesOnly: true,
        extensions: exts,
        noCache: true
    }).then((items) => {
        this._assets = [];
        this._meshTextures = {};
        this._meshMtls = {};
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

    // Find only OBJ and STL files
    this._assets = paths.filter((p) => ['obj', 'stl'].indexOf(extname(p)) > -1);

    // Initialize texture map
    this._assets.forEach((p) => {
        let ext;
        for (var i = 0; i < IMAGE_EXTENSIONS.length; i++) {
            ext = IMAGE_EXTENSIONS[i];
            if (paths.indexOf(stripExtension(p) + '.' + ext) > -1) {
                this._meshTextures[p] = stripExtension(p) + '.' + ext;
                break;
            }
        }

        if (paths.indexOf(stripExtension(p) + '.mtl') > -1) {
            this._meshMtls[p] = stripExtension(p) + '.mtl';
        }
    });
};

Dropbox.prototype._setImageAssets = function (items) {
    this._assets = items.map((item) => item.path);
};

/**
 * List files at the given path, returns a promise resolving with a list of
 * strings
 *
 * options are: - foldersOnly (boolean)
 * 				- filesOnly (boolean)
 * 				- showHidden (boolean)
 * 				- extensions (string[])
 * 				- noCache (boolean)
 *
 * The requests are cached and busted with `noCache=true`, the filtering takes
 * place locally. `foldersOnly` and `filesOnly` will conflict -> nothing
 * returned.
 */
Dropbox.prototype.list = function (path='/', {
    foldersOnly=false,
    filesOnly=false,
    showHidden=false,
    extensions=[],
    noCache=false
}={}) {
    let q;

    // Perform request or load from cache
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

    // Filter
    return q.then((data) => {

        if (!data.is_dir) { // Can only list directories
            throw new Error(`${path} is not a directory`);
        }

        return data.contents.filter(function (item) {

            if (!showHidden && basename(item.path).charAt(0) === '.') {
                return false;
            }

            if (foldersOnly && !item.is_dir) {
                return false;
            }

            if (filesOnly && item.is_dir) {
                return false;
            }

            if (
                !item.is_dir &&
                extensions.length > 0 &&
                extensions.indexOf(extname(item.path)) === -1
            ) {
                return false;
            }

            return true;
        });
    });
};

// Download the content of a file, default response type is text
// as it is the default from the Dropbox API
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

        const {expires, url} = this._mediaCache[path];

        if (expires > new Date()) {
            return Promise.resolve(url);
        }
    }

    const q = getJSON(
        `${API_URL}/media/auto${path}`, {
        headers: this.headers()
    }).then(({url, expires}) => {
        this._mediaCache[path] = {url, expires: new Date(expires)};
        return url;
    });

    this._mediaCache[path] = q;
    return q;
};

// ============================================================================
// Actual Backend related functions
// ============================================================================

Dropbox.prototype.fetchMode = function () {
    return Promise.resolve(this.mode);
};

Dropbox.prototype.fetchTemplates = function () {
    return Promise.resolve(Object.keys(this._templates));
};

Dropbox.prototype.fetchCollections = function () {
    return Promise.resolve([this._assetsPath]);
};

Dropbox.prototype.fetchCollection = function () {
    return Promise.resolve(this._assets.map(function (assetPath) {
        return basename(assetPath, false);
    }));
};

Dropbox.prototype.fetchImg = function (path) {

    if (this._imgCache[path]) {
        return this._imgCache[path];
    }

    const q = this.mediaURL(path).then((u) => {
        return ImagePromise(u).then((data) => {
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
};

Dropbox.prototype.fetchThumbnail = function () {
    return Promise.reject(null);
};

Dropbox.prototype.fetchTexture = function (assetId) {
    const path = `${this._assetsPath}/${assetId}`;
    if (this.mode === 'mesh') {
        if (this._meshTextures[path]) {
            return this.fetchImg(this._meshTextures[path]);
        } else {
            return Promise.reject(null);
        }
    } else {
        return this.fetchImg(path);
    }
};

Dropbox.prototype.fetchGeometry = function (assetId) {

    const path = `${this._assetsPath}/${assetId}`,
          ext = extname(assetId);

    let loader, dl;

    if (ext === 'obj') {
        loader = OBJLoader;
        dl = this.download(path);
    } else if (ext === 'stl') {
        loader = STLLoader;
        dl = this.mediaURL(path).then((u) => {
            const q = getArrayBuffer(u);
            dl.xhr = () => q.xhr();
            return q;
        });
        dl.xhr = function () { return {abort: function () {}}; };
    } else {
        throw new Error('Invalid mesh extension', ext, path);
    }

    const geometry = dl.then((data) => {
        try {
            return loader(data);
        } catch (e) {
            notify({type: 'error', msg: 'Failed to parse mesh file'});
            throw e;
        }
    });

    geometry.xhr = () => dl.xhr(); // compatibility
    geometry.isGeometry = true;
    return geometry;
};

Dropbox.prototype.fetchLandmarkGroup = function (id, type) {

    const path = `${this._assetsPath}/landmarks/${id}_${type}.ljson`;
    const dim = this.mode === 'mesh' ? 3 : 2;
    return new Promise((resolve) => {
        this.download(path).then((data) => {
            resolve(JSON.parse(data));
        }, () => {
            resolve(this._templates[type].emptyLJSON(dim));
        });
    });
};

Dropbox.prototype.saveLandmarkGroup = function (id, type, json) {
    const headers = this.headers(),
          path = `${this._assetsPath}/landmarks/${id}_${type}.ljson`;

    return putJSON(
        `${CONTENTS_URL}/files_put/auto${path}`, {data: json, headers});
};
