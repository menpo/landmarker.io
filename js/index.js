var app;
var sidebar;
var viewport;
var toolbar;

document.addEventListener('DOMContentLoaded', function () {
    var $ = require('jquery');
    var Sidebar = require('./app/sidebar');
    var Toolbar = require('./app/toolbar');
    var Viewport = require('./app/viewport');
    var App = require('./app/app');
    var THREE = require('three');
    // allow CORS loading of textures
    // https://github.com/mrdoob/three.js/issues/687
    THREE.ImageUtils.crossOrigin = "";
    app = new App.App({apiURL: 'http://localhost:5000'});
    sidebar = new Sidebar.Sidebar({model: app});
    // note that we provide the Viewport with the canvas overlay of
    // the viewport as requested.
    viewport = new Viewport.Viewport(
        {
            model: app,
            el: $('#vpoverlay')
        });
    toolbar = new Toolbar.Toolbar({model: app.get('meshSource')});


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

