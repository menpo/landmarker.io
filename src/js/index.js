'use strict';

import $ from 'jquery';
import THREE from 'three';
import url from 'url';
import Promise from 'promise-polyfill';

import * as utils from './app/lib/utils';
import * as support from './app/lib/support';

import * as Notification from './app/view/notification';
import Intro from './app/view/intro';
import AssetView from './app/view/asset';
import SidebarView from './app/view/sidebar';
import HelpOverlay from './app/view/help';
import ToolbarView from './app/view/toolbar';
import URLState from './app/view/url_state';
import ViewportView from './app/view/viewport';
import KeyboardShortcutsHandler from './app/view/keyboard';

import Config from './app/model/config';
import App from './app/model/app';

import Backend from './app/backend';

const cfg = Config();

const mixedContentWarning = `
<p>Your are currently trying to connect to a non secured server from a secure (https) connection. This is  <a href='http://www.howtogeek.com/181911/htg-explains-what-exactly-is-a-mixed-content-warning/'>unadvisable</a> and thus we do not allow it.<br><br>
You can visit <a href='http://insecure.landmarker.io${window.location.search}'>insecure.landmarker.io</a> to disable this warning.</p>
`;

function resolveBackend (u) {
    console.log(
        'Resolving which backend to use for url:', window.location.href, u,
        'and config:', cfg.get());

    // Found a server parameter >> override to traditionnal mode
    if (u.query.server) {
        const serverUrl = utils.stripTrailingSlash(u.query.server);
        cfg.clear(); // Reset all stored data, we use the url
        try {
            const server = new Backend.Server(serverUrl);

            if (!server.demoMode) { // Don't persist demo mode
                cfg.set({
                    'BACKEND_TYPE': Backend.Server.Type,
                    'BACKEND_SERVER_URL': u.query.server
                }, true);
            } else {
                document.title = document.title + ' - demo mode';
            }

            return resolveMode(server, u);
        } catch (e) {
            if (e.message === 'Mixed Content') {
                Intro.close();
                Notification.notify({
                    type: 'error',
                    persist: true,
                    msg: $(mixedContentWarning),
                    actions: [['Restart', utils.restart]]
                });
            } else {
                throw e;
            }
            return null;
        }
    }

    const backendType = cfg.get('BACKEND_TYPE');

    if (!backendType) {
        return Intro.open();
    }

    switch (backendType) {
        case Backend.Dropbox.Type:
            return _loadDropbox(u);
        case Backend.Server.Type:
            return _loadServer(u);
    }
}

var goToDemo = utils.restart.bind(undefined, 'demo');

function retry (msg) {
    Notification.notify({
        msg,
        type: 'error',
        persist: true,
        actions: [
          ['Restart', utils.restart],
          ['Go to Demo', goToDemo]
        ]
    });
}

function _loadServer (u) {
    const server = new Backend.Server(cfg.get('BACKEND_SERVER_URL'));
    u.query.server = cfg.get('BACKEND_SERVER_URL');
    history.replaceState(null, null, url.format(u).replace('?', '#'));
    resolveMode(server, u);
}

function _loadDropbox (u) {

    let dropbox;
    const oAuthState = cfg.get('OAUTH_STATE'),
          token = cfg.get('BACKEND_DROPBOX_TOKEN');

    if (oAuthState) { // We were waiting for redirect

        const urlOk = [
            'state', 'access_token', 'uid'
        ].every(key => u.query.hasOwnProperty(key));

        if (urlOk && u.query.state === oAuthState) {
            cfg.delete('OAUTH_STATE', true);
            dropbox = new Backend.Dropbox(u.query.access_token, cfg);

            delete u.query.access_token;
            delete u.query.token_type;
            delete u.query.state;
            delete u.query.uid;
            u.search = null;
            history.replaceState(null, null, url.format(u).replace('?', '#'));
        } else {
            Notification.notify({
                msg: 'Incorrect Dropbox redirect URL',
                type: 'error'
            });
            Intro.open();
        }
    } else if (token) {
        dropbox = new Backend.Dropbox(token, cfg);
    }

    if (dropbox) {
        dropbox.setMode(cfg.get('BACKEND_DROPBOX_MODE'));
        return dropbox.accountInfo().then(function () {
            _loadDropboxAssets(dropbox, u);
        }, function () {
            Notification.notify({
                msg: 'Could not reach Dropbox servers',
                type: 'error'
            });
            Intro.open();
        });
    } else {
        Intro.open();
    }
}

function _loadDropboxAssets (dropbox, u) {
    const assetsPath = cfg.get('BACKEND_DROPBOX_ASSETS_PATH');

    function _pick () {
        dropbox.pickAssets(function () {
            _loadDropboxTemplates(dropbox, u);
        }, function (err) {
            retry(`Couldn't find assets: ${err}`);
        });
    }

    if (assetsPath) {
        dropbox.setAssets(assetsPath).then(function () {
            _loadDropboxTemplates(dropbox, u);
        }, _pick);
    } else {
        _pick();
    }
}

function _loadDropboxTemplates (dropbox, u) {

    const templatesPaths = cfg.get('BACKEND_DROPBOX_TEMPLATES_PATHS');

    if (templatesPaths) {
        const templatesPromises = [];
        Object.keys(templatesPaths).forEach(function (key) {
            templatesPromises.push(
                dropbox.addTemplate(templatesPaths[key])
            );
        });

        Promise.all(templatesPromises).then(function () {
            resolveMode(dropbox, u);
        });
    } else {
        resolveMode(dropbox, u);
    }
}

function resolveMode (server, u) {
    server.fetchMode().then(function (mode) {
        if (mode === 'mesh' || mode === 'image') {
            initLandmarker(server, mode, u);
        } else {
            retry('Received invalid mode', mode);
        }
    }, function (err) {
        console.log(err);
        retry(`Couldn't reach server, are you sure the url was correct`);
    });
}

function initLandmarker(server, mode, u) {

    console.log('Starting landmarker in ' + mode + ' mode');

    // allow CORS loading of textures
    // https://github.com/mrdoob/three.js/issues/687
    THREE.ImageUtils.crossOrigin = '';

    var appInit = {server: server, mode: mode};

    if (u.query.hasOwnProperty('t')) {
        appInit._activeTemplate = u.query.t;
    }

    if (u.query.hasOwnProperty('c')) {
        appInit._activeCollection = u.query.c;
    }

    if (u.query.hasOwnProperty('i')) {
        appInit._assetIndex = u.query.i - 1;
    }

    var app = new App(appInit);

    new Notification.AssetLoadingNotification({model: app});
    new SidebarView({model: app});
    new AssetView({model: app});
    new ToolbarView({model: app});
    new HelpOverlay({model: app});

    var viewport = new ViewportView({model: app});

    var prevAsset = null;

    app.on('change:asset', function () {
       console.log('Index: the asset has changed');
        viewport.removeMeshIfPresent();
        if (prevAsset !== null) {
            // clean up previous asset
            console.log('Before dispose: ' + viewport.memoryString());
            prevAsset.dispose();
            console.log('After dispose: ' + viewport.memoryString());
        }
        prevAsset = app.asset();
    });

    // update the URL of the page as the state changes
    new URLState({model: app});

    // ----- KEYBOARD HANDLER ----- //
    $(window).off('keydown');
    (new KeyboardShortcutsHandler(app, viewport)).enable();
}

function handleNewVersion () {

    const $topBar = $('#newVersionPrompt');
    $topBar.text(
        'New version has been downloaded in the background, click to reload.');

    $topBar.click(function () {
        window.location.reload(true);
    });

    $topBar.addClass('Display');
}

document.addEventListener('DOMContentLoaded', function () {

    // Check for new version (vs current appcache retrieved version)
    window.applicationCache.addEventListener('updateready', handleNewVersion);
    if(window.applicationCache.status === window.applicationCache.UPDATEREADY) {
        handleNewVersion();
    }

    // Test for IE
    if (support.ie) {
        // Found IE, do user agent detection for now
        // https://github.com/menpo/landmarker.io/issues/75 for progress
        return Notification.notify({
            msg: 'Internet Explorer is not currently supported by landmarker.io, please use Chrome or Firefox',
            persist: true,
            type: 'error'
        });
    }

    // Test for webgl
    if (!support.webgl) {
        return Notification.notify({
            msg: $('<p>It seems your browser doesn\'t support WebGL, which is needed by landmarker.io.<br/>Please visit <a href="https://get.webgl.org/">https://get.webgl.org/</a> for more information<p>'),
            persist: true,
            type: 'error'
        });
    }

    cfg.load();
    Intro.init({cfg});
    var u = url.parse(
        utils.stripTrailingSlash(window.location.href.replace('#', '?')), true);

    $(window).on('keydown', function (evt) {
        if (evt.which === 27) {
            Intro.open();
        }
    });

    resolveBackend(u);
});
