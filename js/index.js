function getURLParameter(name) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' +
        '([^&;]+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20'))||null
}

document.addEventListener('DOMContentLoaded', function () {
    var $ = require('jquery');
    var Sidebar = require('./app/sidebar');
    var Toolbar = require('./app/toolbar');
    var Viewport = require('./app/viewport');
    var App = require('./app/app');
    var Server = require('./app/server');
    var THREE = require('three');
    // allow CORS loading of textures
    // https://github.com/mrdoob/three.js/issues/687
    THREE.ImageUtils.crossOrigin = "";
    var server;
    if (getURLParameter('mode') === 'demo') {
        // put the server in demo mode
        server = new Server.Server({DEMO_MODE: true});
    } else {
        server = new Server.Server({apiURL: 'http://localhost:5000'});
    }
    var app = new App.App({server: server});
    var sidebar = new Sidebar.Sidebar({model: app});
    // note that we provide the Viewport with the canvas overlay of
    // the viewport as requested.
    var viewport = new Viewport.Viewport(
        {
            model: app,
            el: $('#vpoverlay')
        });
    var toolbar = new Toolbar.Toolbar({model: app});

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
                viewport.resetCamera();
                break;
            case 116:  // t = [T]exture toggle
                app.mesh().textureToggle();
                break;
            case 119:  // w = [W]ireframe toggle
                app.mesh().wireframeToggle();
                break;
            case 97:  // a = select [A]ll
                app.landmarks().selectAllInActiveGroup();
                break;
        }
    });
});

