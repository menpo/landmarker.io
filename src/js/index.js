"use strict";

var $ = require('jquery'),
    url = require('url'),
    THREE = require('three');

var utils = require('./app/lib/utils');
var support = require('./app/lib/support');
var Notification = require('./app/view/notification');
var cfg = require('./app/model/config')();

var DropboxPicker = require('./app/view/dropbox_picker'),
    Modal = require('./app/view/modal'),
    SelectModal = require('./app/view/select_modal');

var Backend = require('./app/backend');

function resolveBackend (u) {
    console.log(
        'Resolving which backend to use for url:', window.location.href, u,
        'and config:', cfg.get());

    // Found a server parameter >> override to traditionnal mode
    if (u.query.server) {
        let serverUrl = utils.stripTrailingSlash(u.query.server);
        let server = new Backend.Server(serverUrl);
        cfg.clear(); // Reset all stored data, we use the url

        if (!server.demoMode) { // Don't persist demo mode
            cfg.set({
                'BACKEND_TYPE': Backend.Server.Type,
                'BACKEND_SERVER_URL': u.query.server
            }, true);
        }

        return resolveMode(server);
    }

    let backendType = cfg.get('BACKEND_TYPE');

    if (!backendType) {
        cfg.clear();
        u.search = null;
        history.replaceState(null, null, url.format(u).replace('?', '#'));

        return showSelection();
    }

    switch (backendType) {
        case Backend.Dropbox.Type:
            return _loadDropbox(u);
        case Backend.Server.Type:
            return _loadServer(u);
    }
}

function restart (serverUrl) {
    cfg.clear();
    let restartUrl = (
        window.location.origin +
        window.location.pathname +
        (serverUrl ? `?server=${serverUrl}` : '')
    );
    window.location.replace(restartUrl);
}

var goToDemo = restart.bind(undefined, 'demo');

function showSelection () {
    cfg.clear();
    history.replaceState(null, null, window.location.origin);
    let selector = new SelectModal({
        closable: false,
        disposeOnClose: true,
        title: 'Select a datasource',
        actions: [
            ['Dropbox', function () {
                if (!support.localstorage) {
                    retry(`You browser doesn't support localstorage which is required for Dropbox login`);
                }
                var [dropUrl, state] = Backend.Dropbox.authorize();
                cfg.set({
                    'OAUTH_STATE': state,
                    'BACKEND_TYPE': Backend.Dropbox.Type
                }, true);
                window.location.replace(dropUrl);
            }], ['Managed Server', function () {
                let u = window.prompt(
                    'Please provide the url for the landmarker server');
                if (u) {
                    restart(u);
                }
            }], ['Demo Mode', goToDemo]
        ]
    });

    return selector.open();
}

function retry (msg) {
    Notification.notify({
        msg, type: 'error', persist: true,
        actions: [['Restart', restart], ['Go to Demo', goToDemo]]
    });
}

function _loadServer (u) {
    let server = new Backend.Server(cfg.get('BACKEND_SERVER_URL'));
    u.query.server = cfg.get('BACKEND_SERVER_URL');
    history.replaceState(null, null, url.format(u).replace('?', '#'));
    resolveMode(server);
}

function _loadDropbox (u) {

    let dropbox;
    let oAuthState = cfg.get('OAUTH_STATE'),
        token = cfg.get('BACKEND_DROPBOX_TOKEN');

    if (oAuthState) { // We were waiting for redirect

        let urlOk = [
            'state', 'access_token', 'uid'
        ].every(key => u.query.hasOwnProperty(key));

        if (urlOk && u.query.state === oAuthState) {
            cfg.delete('OAUTH_STATE', true);
            dropbox = new Backend.Dropbox(u.query['access_token'], cfg);

            delete u.query['access_token'];
            delete u.query['token_type'];
            delete u.query['state'];
            delete u.query['uid'];
            u.search = null;
            history.replaceState(null, null, url.format(u).replace('?', '#'));
        } else {
            Notification.notify({
                msg: 'Incorrect Dropbox redirect URL',
                type: 'error'
            });
            showSelection();
        }
    } else if (token) {
        dropbox = new Backend.Dropbox(token, cfg);
    }

    if (dropbox) {
        return dropbox.accountInfo().then(function () {
            _loadDropboxAssets(dropbox)
        }, function () {
            Notification.notify({
                msg: 'Could not reach Dropbox servers',
                type: 'error'
            });
            showSelection();
        });
    } else {
        showSelection();
    }
};

function _loadDropboxAssets (dropbox) {
    let assetsPath = cfg.get('BACKEND_DROPBOX_ASSETS_PATH');

    function _pick () {
        dropbox.pickAssets(function () {
            _loadDropboxTemplate(dropbox);
        }, function (err) {
            retry(`Couldn't find assets: ${err}`);
        });
    }

    if (assetsPath) {
        dropbox.setAssets(assetsPath).then(function () {
            _loadDropboxTemplate(dropbox);
        }, _pick);
    } else {
        _pick();
    }
}

function _loadDropboxTemplate (dropbox) {

    let templatePath = cfg.get('BACKEND_DROPBOX_TEMPLATE_PATH');

    function _pick () {
        console.log('TMPL PICK');
        dropbox.pickTemplate(function () {
            resolveMode(dropbox);
        }, function (err) {
            retry(`Couldn't find template: ${err}`);
        });
    }

    if (templatePath) {
        dropbox.setTemplate(templatePath).then(function () {
            resolveMode(dropbox);
        }, _pick);
    } else {
        console.log('NOT FOUND', cfg.get());
        _pick();
    }
}

function resolveMode (server) {
    server.fetchMode().then(function (mode) {
        if (mode === 'mesh' || mode === 'image') {
            initLandmarker(server, mode);
        } else {
            retry('Received invalid mode', mode);
        }
    }, function () {
        if (server instanceof Backend.Server) {
            server.testForV1(function () {
                retry(`Couldn't get mode from server`);
            });
        } else {
            retry(`Couldn't get mode from server`);
        }
    });
}

function initLandmarker(server, mode) {

    console.log('Starting landmarker in ' + mode + ' mode');

    if (server.demoMode) {
        document.title = document.title + ' - demo mode';
    }

    var App = require('./app/model/app');
    var History = require('./app/view/history');

    // allow CORS loading of textures
    // https://github.com/mrdoob/three.js/issues/687
    THREE.ImageUtils.crossOrigin = "";

    // Parse the current url so we can query the parameters
    var u = url.parse(window.location.href.replace('#', '?'), true);
    u.search = null;  // erase search so query is used in building back URL

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

    var SidebarView = require('./app/view/sidebar');
    var AssetView = require('./app/view/asset');
    var ToolbarView = require('./app/view/toolbar');
    var ViewportView = require('./app/view/viewport');
    var HelpOverlay = require('./app/view/help');

    // var preview = new Notification.ThumbnailNotification({model:app});
    var loading = new Notification.AssetLoadingNotification({model:app});
    var sidebar = new SidebarView.Sidebar({model: app});
    var assetView = new AssetView.AssetView({model: app});
    var viewport = new ViewportView.Viewport({model: app});
    var toolbar = new ToolbarView.Toolbar({model: app});
    var helpOverlay = new HelpOverlay({model: app});

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
    var historyUpdate = new History.HistoryUpdate({model: app});

    // ----- KEYBOARD HANDLER ----- //

    // Non escape keys
    $(window).keypress(function(e) {

        if ($(e.target).closest("input")[0]) {
            return;
        }

        var key = e.which;
        switch (key) {
            case 100:  // d = [d]elete selected
                app.landmarks().deleteSelected();
                $('#viewportContainer').trigger("groupDeselected");
                break;
            case 113:  // q = deselect all
                app.landmarks().deselectAll();
                $('#viewportContainer').trigger("groupDeselected");
                break;
            case 114:  // r = [r]eset camera
                // TODO fix for multiple cameras (should be in camera controller)
                viewport.resetCamera();
                break;
            case 116:  // t = toggle [t]exture (mesh mode only)
                if (app.meshMode()) {
                    app.asset().textureToggle();
                }
                break;
            case 97:  // a = select [a]ll
                app.landmarks().selectAll();
                $('#viewportContainer').trigger("groupSelected");
                break;
            case 103:  // g = complete [g]roup selection
                $('#viewportContainer').trigger("completeGroupSelection");
                break;
            case 99:  // c = toggle [c]amera mode
                if (app.meshMode()) {
                    viewport.toggleCamera();
                }
                break;
            case 106:  // j = down, next asset
                app.nextAsset();
                break;
            case 107:  // k = up, previous asset
                app.previousAsset();
                break;
            case 108:  // l = toggle [l]inks
                app.toggleConnectivity();
                break;
            case 101:  // e = toggle [e]dit mode
                app.toggleEditing();
                break;
            case 63: // toggle help
                app.toggleHelpOverlay();
                break;
        }
    });

    // Escape key
    $(window).on('keydown', function (evt) {

        if (evt.which !== 27) {
            return;
        }

        const modal = Modal.active();
        if (modal) {
            return modal.close();
        }

        app.landmarks().deselectAll();
        $('#viewportContainer').trigger("groupDeselected");
    });
}

function handleNewVersion () {

    let $topBar = $('#newVersionPrompt');
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
        // https://github.com/menpo/landmarker.io/issues/75 for progess
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

    // Temporary message for v1.5.0
    if (localStorage.getItem('LMIO#v150')) {
        $('#v150Prompt').remove();
    } else {
        $('#v150Prompt').addClass('Display');
        $('#v150Prompt').click(function () {
            localStorage.setItem('LMIO#v150', Date().toString());
            window.location = 'https://github.com/menpo/landmarker.io/wiki/Introducing-Snap-Mode-(v1.5.0)';
        })
    }

    cfg.load();
    // Parse the current url so we can query the parameters
    var u = url.parse(
        utils.stripTrailingSlash(window.location.href.replace('#', '?')), true);
    resolveBackend(u);
});
