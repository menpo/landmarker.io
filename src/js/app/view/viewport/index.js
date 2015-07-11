"use strict";

var $ = require('jquery');
var _ = require('underscore');
var Backbone = require('../../lib/backbonej');
var THREE = require('three');

var atomic = require('../../model/atomic');
var octree = require('../../model/octree');

var Handler = require('./handler');
var Camera = require('./camera');

var { LandmarkConnectionTHREEView,
      LandmarkTHREEView } = require('./elements');

// uncomment to monitor FPS performance
//
//var Stats = require('stats-js');
//
//var stats = new Stats();
//stats.setMode(0); // 0: fps, 1: ms
//
//// Align top-left
//stats.domElement.style.position = 'absolute';
//stats.domElement.style.right = '0px';
//stats.domElement.style.top = '0px';
//
//document.body.appendChild(stats.domElement);

// clear colour for both the main view and PictureInPicture
var CLEAR_COLOUR = 0xEEEEEE;
var CLEAR_COLOUR_PIP = 0xCCCCCC;

var MESH_MODE_STARTING_POSITION = new THREE.Vector3(1.0, 0.20, 1.5);
var IMAGE_MODE_STARTING_POSITION = new THREE.Vector3(0.0, 0.0, 1.0);

var PIP_WIDTH = 300;
var PIP_HEIGHT = 300;
var PIP_MARGIN = 0;

var MESH_SCALE = 1.0;

exports.Viewport = Backbone.View.extend({

    el: '#canvas',
    id: 'canvas',

    initialize: function () {
        // ----- CONFIGURATION ----- //
        this.meshScale = MESH_SCALE;  // The radius of the mesh's bounding sphere

        // TODO bind all methods on the Viewport
        _.bindAll(this, 'resize', 'render', 'changeMesh',
            'mousedownHandler', 'update', 'lmViewsInSelectionBox');

        // ----- DOM ----- //
        // We have three DOM concerns:
        //
        //  viewportContainer: a flexbox container for general UI sizing
        //    - vpoverlay: a Canvas overlay for 2D UI drawing
        //    - viewport: our THREE managed WebGL view
        //
        // The viewport and vpoverlay need to be position:fixed for WebGL
        // reasons. we listen for document resize and keep the size of these
        // two children in sync with the viewportContainer parent.
        this.$container = $('#viewportContainer');
        // and grab the viewport div
        this.$webglel = $('#viewport');
        // keep a hold of the width and height (this will be adjusted in resize)
        this.width = this.$container.width();
        this.height = this.$container.height();
        // Get a hold on the overlay canvas and its context (note we use the
        // id - the Viewport should be passed the canvas element on
        // construction)
        this.canvas = document.getElementById(this.id);
        this.ctx = this.canvas.getContext('2d');

        // to be efficient we want to track what parts of the canvas we are
        // drawing into each frame. This way we only need clear the relevant
        // area of the canvas which is a big perf win.
        // see this.updateCanvasBoundingBox() for usage.
        this.ctxBox = {minX: 999999, minY: 999999, maxX: 0, maxY: 0};


        // ------ SCENE GRAPH CONSTRUCTION ----- //
        this.scene = new THREE.Scene();

        // we use an initial top level to handle the absolute positioning of
        // the mesh and landmarks. Rotation and scale are applied to the
        // s_meshAndLms node directly.
        this.s_scaleRotate = new THREE.Object3D();
        this.s_translate = new THREE.Object3D();

        // ----- SCENE: MODEL AND LANDMARKS ----- //
        // s_meshAndLms stores the mesh and landmarks in the meshes original
        // coordinates. This is always transformed to the unit sphere for
        // consistency of camera.
        this.s_meshAndLms = new THREE.Object3D();
        // s_lms stores the scene landmarks. This is a useful container to
        // get at all landmarks in one go, and is a child of s_meshAndLms
        this.s_lms = new THREE.Object3D();
        this.s_meshAndLms.add(this.s_lms);
        // s_mesh is the parent of the mesh itself in the THREE scene.
        // This will only ever have one child (the mesh).
        // Child of s_meshAndLms
        this.s_mesh = new THREE.Object3D();
        this.s_meshAndLms.add(this.s_mesh);
        this.s_translate.add(this.s_meshAndLms);
        this.s_scaleRotate.add(this.s_translate);
        this.scene.add(this.s_scaleRotate);

        // ----- SCENE: CAMERA AND DIRECTED LIGHTS ----- //
        // s_camera holds the camera, and (optionally) any
        // lights that track with the camera as children
        this.s_oCam = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 20);
        this.s_oCamZoom = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 20);
        this.s_pCam = new THREE.PerspectiveCamera(50, 1, 0.02, 20);
        // start with the perspective camera as the main one
        this.s_camera = this.s_pCam;

        // create the cameraController to look after all camera state.
        this.cameraController = Camera.CameraController(
            this.s_pCam, this.s_oCam, this.s_oCamZoom,
            this.el, this.model.imageMode());

        // when the camera updates, render
        this.cameraController.on("change", this.update);

        if (!this.model.meshMode()) {
            // for images, default to orthographic camera
            // (note that we use toggle to make sure the UI gets updated)
            this.toggleCamera();
        }

        this.resetCamera();

        // ----- SCENE: GENERAL LIGHTING ----- //
        // TODO make lighting customizable
        // TODO no spot light for images
        this.s_lights = new THREE.Object3D();
        var pointLightLeft = new THREE.PointLight(0x404040, 1, 0);
        pointLightLeft.position.set(-100, 0, 100);
        this.s_lights.add(pointLightLeft);
        var pointLightRight = new THREE.PointLight(0x404040, 1, 0);
        pointLightRight.position.set(100, 0, 100);
        this.s_lights.add(pointLightRight);
        this.scene.add(this.s_lights);
        // add a soft white ambient light
        this.s_lights.add(new THREE.AmbientLight(0x404040));

        this.renderer = new THREE.WebGLRenderer(
            { antialias: false, alpha: false,
              devicePixelRatio: window.devicePixelRatio || 1 });
        this.renderer.setClearColor(CLEAR_COLOUR, 1);
        this.renderer.autoClear = false;
        // attach the render on the element we picked out earlier
        this.$webglel.html(this.renderer.domElement);

        // we  build a second scene for various helpers we may need
        // (intersection planes) and for connectivity information (so it
        // shows through)
        this.sceneHelpers = new THREE.Scene();

        // s_lmsconnectivity is used to store the connectivity representation
        // of the mesh. Note that we want
        this.s_lmsconnectivity = new THREE.Object3D();
        // we want to replicate the mesh scene graph in the scene helpers, so we can
        // have show-though connectivity..
        this.s_h_scaleRotate = new THREE.Object3D();
        this.s_h_translate = new THREE.Object3D();
        this.s_h_meshAndLms = new THREE.Object3D();
        this.s_h_meshAndLms.add(this.s_lmsconnectivity);
        this.s_h_translate.add(this.s_h_meshAndLms);
        this.s_h_scaleRotate.add(this.s_h_translate);
        this.sceneHelpers.add(this.s_h_scaleRotate);

        // add mesh if there already is one present (we could have missed a
        // backbone callback).
        this.changeMesh();

        // make an empty list of landmark views
        this.landmarkViews = [];
        this.connectivityViews = [];

        // Tools for moving between screen and world coordinates
        this.ray = new THREE.Raycaster();

        // ----- MOUSE HANDLER ----- //
        // There is quite a lot of finicky state in handling the mouse
        // interaction which is of no concern to the rest of the viewport.
        // We wrap all this complexity up in a closure so it can enjoy access
        // to the general viewport state without leaking it's state all over
        // the place.
        this._handler = Handler.apply(this);

        // ----- BIND HANDLERS ----- //
        window.addEventListener('resize', this.resize, false);
        this.listenTo(this.model, "newMeshAvailable", this.changeMesh);
        this.listenTo(this.model, "change:landmarks", this.changeLandmarks);

        this.showConnectivity = true;
        this.listenTo(
            this.model,
            "change:connectivityOn",
            this.updateConnectivityDisplay
        );
        this.updateConnectivityDisplay();

        this.listenTo(
            this.model, "change:editingOn", this.updateEditingDisplay);
        this.updateEditingDisplay();

        // Reset helper views on wheel to keep scale
        // this.$el.on('wheel', () => {
        //     this.clearCanvas();
        // });

        this.listenTo(atomic, "change:ATOMIC_OPERATION", this.batchHandler);

        // trigger resize to initially size the viewport
        // this will also clearCanvas (will draw context box if needed)
        this.resize();

        // register for the animation loop
        animate();

        function animate() {
            requestAnimationFrame(animate);
            // uncomment to monitor FPS performance
            //stats.update();
        }

        $('#viewportContainer').on('groupSelected', () => {
            this._handler.setGroupSelected(true);
        });

        $('#viewportContainer').on('groupDeselected', () => {
            this._handler.setGroupSelected(false);
        });

        $('#viewportContainer').on('completeGroupSelection', () => {
            this._handler.completeGroupSelection();
        });
    },

    changeMesh: function () {
        var meshPayload, mesh, up, front;
        console.log('Viewport:changeMesh - memory before: ' +  this.memoryString());
        // firstly, remove any existing mesh
        this.removeMeshIfPresent();

        meshPayload = this.model.mesh();
        if (meshPayload === null) {
            return;
        }
        mesh = meshPayload.mesh;
        up = meshPayload.up;
        front = meshPayload.front;
        this.mesh = mesh;

        if(mesh.geometry instanceof THREE.BufferGeometry) {
            // octree only makes sense if we are dealing with a true mesh
            // (not images). Such meshes are always BufferGeometry instances.
            this.octree = octree.octreeForBufferGeometry(mesh.geometry);
        }

        this.s_mesh.add(mesh);
        // Now we need to rescale the s_meshAndLms to fit in the unit sphere
        // First, the scale
        this.meshScale = mesh.geometry.boundingSphere.radius;
        var s = 1.0 / this.meshScale;
        this.s_scaleRotate.scale.set(s, s, s);
        this.s_h_scaleRotate.scale.set(s, s, s);
        this.s_scaleRotate.up.copy(up);
        this.s_h_scaleRotate.up.copy(up);
        this.s_scaleRotate.lookAt(front.clone());
        this.s_h_scaleRotate.lookAt(front.clone());
        // translation
        var t = mesh.geometry.boundingSphere.center.clone();
        t.multiplyScalar(-1.0);
        this.s_translate.position.copy(t);
        this.s_h_translate.position.copy(t);
        this.update();
    },

    removeMeshIfPresent: function () {
        if (this.mesh !== null) {
            this.s_mesh.remove(this.mesh);
            this.mesh = null;
            this.octree = null;
        }
    },

    memoryString: function () {
        return  'geo:' + this.renderer.info.memory.geometries +
                ' tex:' + this.renderer.info.memory.textures +
                ' prog:' + this.renderer.info.memory.programs;
    },

    // this is called whenever there is a state change on the THREE scene
    update: function () {
        if (!this.renderer) {
            return;
        }
        // if in batch mode - noop.
        if (atomic.atomicOperationUnderway()) {
            return;
        }
        //console.log('Viewport:update');
        // 1. Render the main viewport
        var w, h;
        w = this.$container.width();
        h = this.$container.height();
        this.renderer.setViewport(0, 0, w, h);
        this.renderer.setScissor(0, 0, w, h);
        this.renderer.enableScissorTest (true);
        this.renderer.clear();
        this.renderer.render(this.scene, this.s_camera);

        if (this.showConnectivity) {
            this.renderer.clearDepth(); // clear depth buffer
            // and render the connectivity
            this.renderer.render(this.sceneHelpers, this.s_camera);
        }

        // 2. Render the PIP image if in orthographic mode
        if (this.s_camera === this.s_oCam) {
            var minX, minY, pipW, pipH;
            var bounds = this.pilBounds();
            minX = bounds[0];
            minY = bounds[1];
            pipW = bounds[2];
            pipH = bounds[3];
            this.renderer.setClearColor(CLEAR_COLOUR_PIP, 1);
            this.renderer.setViewport(minX, minY, pipW, pipH);
            this.renderer.setScissor(minX, minY, pipW, pipH);
            this.renderer.enableScissorTest(true);
            this.renderer.clear();
            // render the PIP image
            this.renderer.render(this.scene, this.s_oCamZoom);
            if (this.showConnectivity) {
                this.renderer.clearDepth(); // clear depth buffer
                // and render the connectivity
                this.renderer.render(this.sceneHelpers, this.s_oCamZoom);
            }
            this.renderer.setClearColor(CLEAR_COLOUR, 1);
        }
    },

    toggleCamera: function () {
        // check what the current setting is
        var currentlyPerspective = (this.s_camera === this.s_pCam);
        if (currentlyPerspective) {
            // going to orthographic - start listening for pip updates
            this.listenTo(this.cameraController, "changePip", this.update);
            this.s_camera = this.s_oCam;
        } else {
            // leaving orthographic - stop listening to pip calls.
            this.stopListening(this.cameraController, "changePip");
            this.s_camera = this.s_pCam;
        }
        // clear the canvas to make
        this.clearCanvas();
        this.update();
    },

    pilBounds: function () {
        var w = this.$container.width();
        var h = this.$container.height();
        var maxX = w - PIP_MARGIN;
        var maxY = h - PIP_MARGIN;
        var minX = maxX - PIP_WIDTH;
        var minY = maxY - PIP_HEIGHT;
        return [minX, minY, PIP_WIDTH, PIP_HEIGHT];
    },

    resetCamera: function () {
        // reposition the cameras and focus back to the starting point.
        var v = this.model.meshMode() ? MESH_MODE_STARTING_POSITION :
                                        IMAGE_MODE_STARTING_POSITION;

        this.cameraController.position(v);
        this.cameraController.focus(this.scene.position);
        this.update();
    },

    // Event Handlers
    // =========================================================================

    events: {
        'mousedown' : "mousedownHandler",
    },

    mousedownHandler: function (event) {
        event.preventDefault();
        this._handler.onMouseDown(event);
    },

    updateConnectivityDisplay: atomic.atomicOperation(function () {
        this.showConnectivity = this.model.isConnectivityOn();
    }),

    updateEditingDisplay: atomic.atomicOperation(function () {
        this.editingOn = this.model.isEditingOn();
        this.clearCanvas();
        this._handler.setGroupSelected(false);

        // Manually bind to avoid useless function call (even with no effect)
        if (this.editingOn) {
            this.$el.on('mousemove', this._handler.onMouseMove);
        } else {
            this.$el.off('mousemove', this._handler.onMouseMove);
        }
    }),

    deselectAll: function () {
        let lms = this.model.get('landmarks');
        if (lms) {
            lms.deselectAll();
        }
    },

    resize: function () {
        var w, h, pixelRatio;
        w = this.$container.width();
        h = this.$container.height();

        // update the width and height on self
        self.width = w;
        self.height = h;
        // ask the camera controller to update the cameras appropriately
        this.cameraController.resize(w, h);
        // update the size of the renderer and the canvas
        this.renderer.setSize(w, h);

        // get the resolution of our device.
        pixelRatio = window.devicePixelRatio || 1;

        // scale the canvas and change its CSS width/height to make it high res.
        this.canvas.style.width = w;
        this.canvas.style.height = h;
        this.canvas.width = w * pixelRatio;
        this.canvas.height = h * pixelRatio;

        // Now that its high res we need to compensate so our images can be drawn as
        //normal, by scaling everything up by the pixelRatio.
        this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        // clear the canvas to make sure the PIP box is correct
        this.clearCanvas();
        this.update();
    },

    batchHandler: function (dispatcher) {
        if (dispatcher.atomicOperationFinished()) {
            // just been turned off - trigger an update.
            this.update();
        }
    },

    changeLandmarks: atomic.atomicOperation(function () {
        console.log('Viewport: landmarks have changed');
        var that = this;

        // 1. Dispose of all landmark and connectivity views
        _.map(this.landmarkViews, function (lmView) {
            lmView.dispose();
        });
        _.map(this.connectivityViews, function (connView) {
            connView.dispose();
        });

        // 2. Build a fresh set of views - clear any existing views
        this.landmarkViews = [];
        this.connectivityViews = [];

        var landmarks = this.model.get('landmarks');
        if (landmarks === null) {
            // no actual landmarks available - return
            // TODO when can this happen?!
            return;
        }
        landmarks.landmarks.map(function (lm) {
            that.landmarkViews.push(new LandmarkTHREEView(
                {
                    model: lm,
                    viewport: that
                }));
        });
        landmarks.connectivity.map(function (a_to_b) {
           that.connectivityViews.push(new LandmarkConnectionTHREEView(
               {
                   model: [landmarks.landmarks[a_to_b[0]],
                           landmarks.landmarks[a_to_b[1]]],
                   viewport: that
               }));
        });

    }),

    // 2D Canvas helper functions
    // ========================================================================

    updateCanvasBoundingBox: function(point) {
        // update the canvas bounding box to account for this new point
        this.ctxBox.minX = Math.min(this.ctxBox.minX, point.x);
        this.ctxBox.minY = Math.min(this.ctxBox.minY, point.y);
        this.ctxBox.maxX = Math.max(this.ctxBox.maxX, point.x);
        this.ctxBox.maxY = Math.max(this.ctxBox.maxY, point.y);
    },

    drawSelectionBox: function (mouseDown, mousePosition) {
        var x = mouseDown.x;
        var y = mouseDown.y;
        var dx = mousePosition.x - x;
        var dy = mousePosition.y - y;
        this.ctx.strokeRect(x, y, dx, dy);
        // update the bounding box
        this.updateCanvasBoundingBox(mouseDown);
        this.updateCanvasBoundingBox(mousePosition);
    },

    drawTargetingLines: function (point, targetLm, secondaryLms) {

        this.updateCanvasBoundingBox(point);

        // first, draw the secondary lines
        this.ctx.save();
        this.ctx.strokeStyle = "#7ca5fe";
        this.ctx.setLineDash([5, 15]);

        this.ctx.beginPath();
        secondaryLms.forEach((lm) => {
            var lmPoint = this.localToScreen(lm.point());
            this.updateCanvasBoundingBox(lmPoint);
            this.ctx.moveTo(lmPoint.x, lmPoint.y);
            this.ctx.lineTo(point.x, point.y);
        });
        this.ctx.stroke();
        this.ctx.restore();

        // now, draw the primary line
        this.ctx.strokeStyle = "#01e6fb";

        this.ctx.beginPath();
        var targetPoint = this.localToScreen(targetLm.point());
        this.updateCanvasBoundingBox(targetPoint);
        this.ctx.moveTo(targetPoint.x, targetPoint.y);
        this.ctx.lineTo(point.x, point.y);
        this.ctx.stroke();
    },

    clearCanvas: function () {
        // we only want to clear the area of the canvas that we dirtied
        // since the last clear. The ctxBox object tracks this
        var p = 3;  // padding to be added to bounding box
        var minX = Math.max(Math.floor(this.ctxBox.minX) - p, 0);
        var minY = Math.max(Math.floor(this.ctxBox.minY) - p, 0);
        var maxX = Math.ceil(this.ctxBox.maxX) + p;
        var maxY = Math.ceil(this.ctxBox.maxY) + p;
        var width = maxX - minX;
        var height = maxY - minY;
        this.ctx.clearRect(minX, minY, width, height);
        // reset the tracking of the context bounding box tracking.
        this.ctxBox = {minX: 999999, minY: 999999, maxX: 0, maxY: 0};
        this.ctx.strokeStyle = '#ffffff';
        if (this.s_camera === this.s_oCam) {
            // orthographic means there is the PIP window. Draw the box and
            // target.
            var b = this.pilBounds();
            var minX = b[0];
            var minY = this.canvas.height - b[1] - b[3];
            var width = b[2];
            var height = b[3];
            var maxX = minX + width;
            var maxY = minY + height;
            var midX = (2 * minX + width)/2;
            var midY = (2 * minY + height) / 2;
            // vertical line
            this.ctx.strokeRect(minX, minY, width, height);
            this.ctx.beginPath();
            this.ctx.moveTo(midX, minY);
            this.ctx.lineTo(midX, maxY);
            this.ctx.closePath();
            this.ctx.stroke();
            // horizontal line
            this.ctx.beginPath();
            this.ctx.moveTo(minX, midY);
            this.ctx.lineTo(maxX, midY);
            this.ctx.closePath();
            this.ctx.stroke();
        }
    },

    // Coordinates and intersection helpers
    // =========================================================================

    getIntersects: function (x, y, object) {
        if (object === null || object.length === 0) {
            return [];
        }
        var vector = new THREE.Vector3((x / this.width) * 2 - 1,
                                        -(y / this.height) * 2 + 1, 0.5);

        if (this.s_camera === this.s_pCam) {
            // perspective selection
            vector.setZ(0.5);
            vector.unproject(this.s_camera);
            this.ray.set(this.s_camera.position, vector.sub(this.s_camera.position).normalize());
        } else {
            // orthographic selection
            vector.setZ(-1);
            vector.unproject(this.s_camera);
            var dir = new THREE.Vector3(0, 0, - 1).transformDirection(this.s_camera.matrixWorld);
            this.ray.set(vector, dir);
        }

        if (object === this.mesh && this.octree) {
            // we can use the octree to intersect the mesh efficiently.
            return octree.intersetMesh(this.ray, this.mesh, this.octree);
        } else if (object instanceof Array) {
            return this.ray.intersectObjects(object, true);
        } else {
            return this.ray.intersectObject(object, true);
        }
    },

    getIntersectsFromEvent: function (event, object) {
      return this.getIntersects(event.clientX, event.clientY, object);
    },

    worldToScreen: function (vector) {
        var widthHalf = this.width / 2;
        var heightHalf = this.height / 2;
        var result = vector.project(this.s_camera);
        result.x = (result.x * widthHalf) + widthHalf;
        result.y = -(result.y * heightHalf) + heightHalf;
        return result;
    },

    localToScreen: function (vector) {
        return this.worldToScreen(
            this.s_meshAndLms.localToWorld(vector.clone()));
    },

    worldToLocal: function (vector, inPlace=false) {
        return inPlace ? this.s_meshAndLms.worldToLocal(vector) :
                         this.s_meshAndLms.worldToLocal(vector.clone());
    },

    lmToScreen: function (lmSymbol) {
        var pos = lmSymbol.position.clone();
        this.s_meshAndLms.localToWorld(pos);
        return this.worldToScreen(pos);
    },

    lmViewsInSelectionBox: function (x1, y1, x2, y2) {
        var c;
        var lmsInBox = [];
        var that = this;
        _.each(this.landmarkViews, function (lmView) {
            if (lmView.symbol) {
                c = that.lmToScreen(lmView.symbol);
                if (c.x > x1 && c.x < x2 && c.y > y1 && c.y < y2) {
                    lmsInBox.push(lmView);
                }
            }

        });

        return lmsInBox;
    },

    lmViewVisible: function (lmView) {
        if (!lmView.symbol) {
            return false;
        }
        var screenCoords = this.lmToScreen(lmView.symbol);
        // intersect the mesh and the landmarks
        var iMesh = this.getIntersects(
            screenCoords.x, screenCoords.y, this.mesh);
        var iLm = this.getIntersects(
            screenCoords.x, screenCoords.y, lmView.symbol);
        // is there no mesh here (pretty rare as landmarks have to be on mesh)
        // or is the mesh behind the landmarks?
        return iMesh.length == 0 || iMesh[0].distance > iLm[0].distance;
    },

});
