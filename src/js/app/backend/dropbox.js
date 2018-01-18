/**
 * Dropbox backend interface
 *
 * Until https://github.com/dropbox/dropbox-js/pull/183/ gets merged and
 * related issues are fixed, dropbox-js doesn't work with browserify, given the
 * small subset of api endpoint we use, we roll our own http interface for now.
 *
 * API v1 to API v2 migration
 */
'use strict';
// const API_KEY = 'lar7e1dae96efyx',

const API_KEY = 'lar7e1dae96efyx',
    API_URL = 'https://api.dropboxapi.com/2',
    CONTENTS_URL = 'https://content.dropboxapi.com/2';

const IMAGE_EXTENSIONS = ['jpeg', 'jpg', 'png'];
const MESH_EXTENSIONS = ['obj', 'stl', 'mtl'].concat(IMAGE_EXTENSIONS);

import {format} from 'url';
import Promise from 'promise-polyfill';

import OBJLoader from '../lib/obj_loader';
import STLLoader from '../lib/stl_loader';
import {
    randomString,
    basename,
    extname,
    stripExtension,
    baseUrl
} from '../lib/utils';
import download from '../lib/download';

import {notify} from '../view/notification';
import {postJSON, postMetaJSON, postDownloadJSON, postJSONData, postUploadJSON, getArrayBuffer} from '../lib/requests';
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
    this._imgId = '';

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
        pathname: '/oauth2/authorize',
        query: {
            'response_type': 'token',
            'redirect_uri': baseUrl(),
            'state': oAuthState,
            'client_id': API_KEY
        }
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
    return postJSON(`${API_URL}/users/get_current_account`, {headers: this.headers()});
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
Dropbox.prototype.pickTemplate = function (success, error, closable = false) {
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

Dropbox.prototype.pickAssets = function (success, error, closable = false) {
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
    const paths = items.map((item) => item.path_display);

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
    this._assets = items.map((item) => item.path_display);
};

/**
 * List files at the given path, returns a promise resolving with a list of
 * strings
 *
 * options are: - foldersOnly (boolean)
 *                - filesOnly (boolean)
 *                - showHidden (boolean)
 *                - extensions (string[])
 *                - noCache (boolean)
 *
 * The requests are cached and busted with `noCache=true`, the filtering takes
 * place locally. `foldersOnly` and `filesOnly` will conflict -> nothing
 * returned.
 */
Dropbox.prototype.list = function (path = '', {
    foldersOnly = false,
    filesOnly = false,
    showHidden = false,
    extensions = [],
    noCache = false
}={}) {
    let q;

    // Perform request or load from cache
    if (this._listCache[path] && !noCache) {
        q = Promise.resolve(this._listCache[path]);
    } else {
        let dataPost = {
            "path": path,
            "include_media_info": false,
            "include_deleted": false,
            "include_has_explicit_shared_members": false
        };
        q = postMetaJSON(
            `${API_URL}/files/list_folder`, {
                headers: this.headers(),
                data: dataPost
            }).then((data) => {

            this._listCache[path] = data;
            return data;
        });
    }

    // Filter
    return q.then((data) => {

        return data.entries.filter(item => {

            if (!showHidden && basename(item.path_display).charAt(0) === '.') {
                return false;
            }

            if (foldersOnly && !(item[".tag"] == "folder")) {
                return false;
            }

            if (filesOnly && (item[".tag"] == "folder")) {
                return false;
            }

            if (
                !(item[".tag"] == "folder") &&
                extensions.length > 0 &&
                extensions.indexOf(extname(item.path_display)) === -1
            ) {
                return false;
            }

            return true;
        });
    });
};

// Download the content of a file, default response type is text
// as it is the default from the Dropbox API
Dropbox.prototype.download = function (path, responseType = 'text') {

    let dataPost = {
        "path": path
    };

    return postDownloadJSON(
        `${CONTENTS_URL}/files/download`, {
            headers: this.headers(),
            dropboxAPI: dataPost
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

    let dataPost = {
        "path": path
    };
    const q = postMetaJSON(
        `${API_URL}/files/get_temporary_link`, {
            headers: this.headers(),
            data: dataPost
        }).then(({link, metadata}) => {
        this._mediaCache[path] = {link, expires: new Date(metadata.server_modified)};
        this._imgId = metadata.id;
        return link;
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
        dl.xhr = function () {
            return {
                abort: function () {
                }
            };
        };
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
Dropbox.prototype.saveLandmarkGroup = function (id, type, json, gender, typeOfPhoto) {
    const headers = this.headers();
    let path = `${this._assetsPath}/landmarks/${id}_${type}.ljson`;
    let data = {
        "path": `${this._assetsPath}/renamed`,
        "query": `${id}`,
        "start": 0,
        "max_results": 500,
        "mode": "filename"
    };

    let split = id.split(".");
    let dataPost = {"path": path, "mode": "overwrite", "autorename": false};
    let dataSearch = {
        "path": `${this._assetsPath}/renamed/${split[0]}${gender}${typeOfPhoto}.${split[1]}`,
        "url": ''
    };
    return postUploadJSON(`${CONTENTS_URL}/files/upload`, {
        headers: headers,
        dropboxAPI: dataPost,
        data: json
    }).then(() => {
        return postJSONData(`${API_URL}/files/search`, {headers: headers, data: data})
    }).then((rs) => {
        let result = JSON.parse(rs);
        if (result["matches"].length > 0) {
            return postJSONData(`${API_URL}/files/delete`, {
                headers: headers,
                data: {"path": result["matches"]["0"]["metadata"]["path_lower"]}
            })
        } else {
            return
        }
    }).then(() => {
        return postJSONData(`${API_URL}/sharing/get_file_metadata`, {headers: headers, data: {"file": this._imgId, "actions": []}})
    }).then((rs) => {
        let result = JSON.parse(rs);

        dataSearch.url = result.preview_url

        return postJSONData(`${API_URL}/files/save_url`, {headers: headers, data: dataSearch})

    })
};
