'use strict';

// the fonts are bundled, so the page needs nothing from a third party (and works offline)
import 'octicons/octicons/octicons.css';
import '@fontsource/roboto/latin-300.css';
import '@fontsource/roboto/latin-300-italic.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-400-italic.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-500-italic.css';
import '@fontsource/roboto/latin-700.css';
import '@fontsource/roboto/latin-700-italic.css';

// include all our style information
import '../scss/main.scss';

import $ from 'jquery';
import * as THREE from 'three';
import url from 'url';

import * as utils from './app/lib/utils';
import * as support from './app/lib/support';

import {notify} from './app/view/notification';
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
<p>This page is served over https, so the browser does not let it talk to a server that is not (<a href='https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content'>mixed content</a>).<br><br>
Serve your assets over https, or run the server on this machine and connect to it as <code>http://localhost:PORT</code>, which browsers do allow.</p>
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
                notify({
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

    if (backendType === Backend.Server.Type) {
        return _loadServer(u);
    }

    // anything else was stored by an older version (Dropbox mode is gone): start over
    return Intro.open();
}

var goToDemo = utils.restart.bind(undefined, 'demo');

function retry (msg) {
    notify({
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
        let idx = u.query.i;
        idx = isNaN(idx) ? 0 : Number(idx);
        appInit._assetIndex = idx > 0 ? idx - 1 : 0;
    }

    var app = new App(appInit);

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

document.addEventListener('DOMContentLoaded', function () {

    // Test for IE
    if (support.ie) {
        // Found IE, do user agent detection for now
        // https://github.com/menpo/landmarker.io/issues/75 for progress
        return notify({
            msg: 'Internet Explorer is not currently supported by landmarker.io, please use Chrome or Firefox',
            persist: true,
            type: 'error'
        });
    }

    // Test for webgl
    if (!support.webgl) {
        return notify({
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

    function canScroll(overflowCSS) {
        return overflowCSS === 'scroll' || overflowCSS === 'auto';
    }

    window.document.ontouchmove = function (event) {
        var isTouchMoveAllowed = false;
        var p = event.target;
        while (p !== null) {
            var style = window.getComputedStyle(p);
            if (style !== null && (canScroll(style.overflow) ||
                                   canScroll(style.overflowX) ||
                                   canScroll(style.overflowY))) {
                isTouchMoveAllowed = true;
                break;
            }
            p = p.parentNode;
        }

        if (!isTouchMoveAllowed) {
            event.preventDefault();
        }

    };

    resolveBackend(u);
});
