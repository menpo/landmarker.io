"use strict";

var $ = require('jquery'),
    url = require('url'),
    THREE = require('three');

var utils = require('./app/lib/utils');
var Notification = require('./app/view/notification');
var cfg = require('./app/model/config')();

var DropboxSelect = require('./app/view/dropbox_select'),
    { SelectModal } = require('./app/view/modal'),
    { notify } = require('./app/view/notification');

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

        let selector = new SelectModal({
            closable: false,
            disposeAfter: false,
            title: 'Select a datasource',
            actions: [
                ['Dropbox', function () {
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
                }], ['Demo Mode', restart.bind(undefined, 'demo')]
            ]
        });

        return selector.open();
    }

    switch (backendType) {
        case Backend.Dropbox.Type:
            return _loadDropbox(u);
        case Backend.Server.Type:
            return _loadServer(u);
    }
}

function restart (serverUrl) {
    console.log('Hard restart', serverUrl);
    cfg.clear();
    let restartUrl = (
        window.location.origin + (serverUrl ? `?server=${serverUrl}` : ''));
    window.location.replace(restartUrl);
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
        if (u.query.state === oAuthState) {
            cfg.delete('OAUTH_STATE', true);
            dropbox = new Backend.Dropbox(u.query['access_token'], cfg);
            delete u.query['access_token'];
            delete u.query['token_type'];
            delete u.query['state'];
            delete u.query['uid'];
            u.search = null;
            history.replaceState(null, null, url.format(u).replace('?', '#'));
        } else {
            console.log('Failed to authenticate after redirect');
        }
    } else if (token) {
        dropbox = new Backend.Dropbox(token, cfg);
    }

    if (dropbox) {
        let pathModal = new DropboxSelect({
            dropbox,
            selectFoldersOnly: true,
            title: 'Where do you whish to load assets from',
            submit: function (path) {
                dropbox.setAssets(path).then(function () {

                    let templateModal = new DropboxSelect({
                        dropbox,
                        selectFilesOnly: true,
                        extensions: Object.keys(Backend.Dropbox.TemplateParsers),
                        title: 'Select a template to use, you can use an already annotated asset',
                        submit: function (tmplPath) {
                            dropbox.loadTemplate(tmplPath).then(function () {
                                templateModal.dispose();
                                resolveMode(dropbox);
                            });
                        }
                    });

                    pathModal.dispose();
                    templateModal.open();
                });
            }
        });

        pathModal.open();
    }
}

function resolveMode (server) {
    server.fetchMode().then(function (mode) {
        if (mode === 'mesh' || mode === 'image') {
            console.log(`Successfully found mode: ${mode}`);
        } else {
            console.log('Error unknown mode - terminating');
        }
        initLandmarker(server, mode);
    }, function () {
        console.log("Error - couldn't get mode");
        notify({
            msg: 'Error unknown mode - terminating',
            type: 'error',
            actions: [
                ['Restart', restart],
                ['See a demo', restart.bind(undefined, 'demo')]
            ]
        });

        if (server instanceof Backend.Server) {
            // could be that there is an old v1 server, let's check
            server.testV1(function () {
                console.log("Error - couldn't get mode (even in legacy v1)");
            });
        }

        return;
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

    var app = App(appInit);

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
        // var mesh = viewport.mesh;
        viewport.removeMeshIfPresent();
        if (prevAsset !== null) {
            // clean up previous asset
            console.log('Index: cleaning up asset');
            console.log('Before dispose: ' + viewport.memoryString());
            prevAsset.dispose();
            console.log('After dispose: ' + viewport.memoryString());

            // if (mesh !== null) {
            //     mesh.dispose();
            // }
        }
        prevAsset = app.asset();
    });

    // update the URL of the page as the state changes
    var historyUpdate = new History.HistoryUpdate({model: app});

    // ----- KEYBOARD HANDLER ----- //
    $(window).keypress(function(e) {
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

    // Test for IE
    if (
        /MSIE (\d+\.\d+);/.test(navigator.userAgent) || !!navigator.userAgent.match(/Trident.*rv[ :]*11\./)
    ) {
        // Found IE, do user agent detection for now
        // https://github.com/menpo/landmarker.io/issues/75 for progess
        $('.App-Flex-Horiz').css('min-height', '100vh');
        return Notification.notify({
            msg: 'Internet Explorer is not currently supported by landmarker.io, please use Chrome or Firefox',
            persist: true,
            type: 'error'
        });
    }

    // Test for webgl
    var webglSupported = ( function () {
        try {
            var canvas = document.createElement('canvas');
            return !! (
                window.WebGLRenderingContext &&
                ( canvas.getContext('webgl') ||
                  canvas.getContext('experimental-webgl') )
            );
        } catch ( e ) { return false; } } )();

    if (!webglSupported) {
        return Notification.notify({
            msg: $('<p>It seems your browser doesn\'t support WebGL, which is needed by landmarker.io.<br/>Please visit <a href="https://get.webgl.org/">https://get.webgl.org/</a> for more information<p>'),
            persist: true,
            type: 'error'
        });
    }

    // Check for new version (vs current appcache retrieved version)
    window.applicationCache.addEventListener('updateready', handleNewVersion);
    if(window.applicationCache.status === window.applicationCache.UPDATEREADY) {
      handleNewVersion();
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
