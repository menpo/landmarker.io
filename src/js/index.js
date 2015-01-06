var DEFAULT_API_URL = 'http://localhost:5000';


function resolveServer(u) {
    var Server = require('./app/model/server');
    var apiUrl = DEFAULT_API_URL;
    if (u.query.hasOwnProperty('server')) {
        if (u.query.server === 'demo') {
            // in demo mode and have mode set.
            document.title = document.title + ' - demo mode';
            var $ = require('jquery');
            $('.App-Viewport-UIText-TopLeft').toggle();
            return new Server.Server({DEMO_MODE: true});
        } else {
            apiUrl = 'https://' + u.query.server;
            console.log('Setting server to provided value: ' + apiUrl);
        }
    } // if no server provided use the default
    return new Server.Server({apiURL: apiUrl});
}

function resolveMode(server) {
    var mode = require('./app/model/mode');
    var modeResolver = new mode.Mode({server: server});
    modeResolver.fetch({
        success: _resolveMode,
        error: restartInDemoMode
    });
}

function _resolveMode(modeResolver) {
    var mode;
    if (modeResolver.has('mesh')) {
        mode = 'mesh';
        console.log('Successfully found mode: mesh');
    } else if (modeResolver.has('image')) {
        mode = 'image';
        console.log('Successfully found mode: image');
    } else {
        console.log('Error unknown mode - terminating');
        restartInDemoMode();
    }
    initLandmarker(modeResolver.get('server'), mode);
}

function restartInDemoMode() {
    // load the url module and parse our URL
    var url = require('url');
    var u = url.parse(window.location.href.replace('#', '?'), true);
    u.search = null;
    u.query.server = 'demo';
    window.location.replace(url.format(u).replace('?', '#'));
    // the url is seemingly the same as we use a # not a ?. As such a reload
    // is needed.
    window.location.reload();
}

function initLandmarker(server, mode) {
    console.log('Starting landmarker in ' + mode + ' mode');
    var $ = require('jquery');
    var SidebarView = require('./app/view/sidebar');
    var AssetView = require('./app/view/asset');
    var ToolbarView = require('./app/view/toolbar');
    var ViewportView = require('./app/view/viewport');
    var Notification = require('./app/view/notification');
    var App = require('./app/model/app');
    var THREE = require('three');
    var url = require('url');
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
    var app = new App.App(appInit);
//    var preview = new Notification.ThumbnailNotification({model:app});
//    var loading = new Notification.AssetLoadingNotification({model:app});
//    var sidebar = new SidebarView.Sidebar({model: app});
//    var assetView = new AssetView.AssetView({model: app});
    var viewport = new ViewportView.Viewport({model: app});
//    var toolbar = new ToolbarView.Toolbar({model: app});

    // update the URL of the page as the state changes
    var historyUpdate = new History.HistoryUpdate({model: app});

    // For debugging, attach to the window.
    window.app = app;
    window.toolbar = toolbar;

    // ----- KEYBOARD HANDLER ----- //
    $(window).keypress(function(e) {
        var key = e.which;
        switch (key) {
            case 100:  // d
                app.landmarks().deleteSelected();
                break;
            case 32:  // space bar = reset camera
                // TODO fix for multiple cameras (should be in camera controller)
                viewport.resetCamera();
                break;
            case 116:  // t = [T]exture toggle (mesh mode only)
                if (app.meshMode()) {
                    app.asset().textureToggle();
                }
                break;
            case 97:  // a = select [A]ll
                app.landmarks().selectAllInActiveGroup();
                break;
            case 99:  // a = toggle [C]amera mode
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
        }
    });
}


document.addEventListener('DOMContentLoaded', function () {
    var url = require('url');
    // Parse the current url so we can query the parameters
    var u = url.parse(window.location.href.replace('#', '?'), true);
    u.search = null;  // erase search so query is used in building back URL

    var server = resolveServer(u);
    // by this point definitely have a correctly set server.

    // check the mode of the server.
    resolveMode(server);
});
