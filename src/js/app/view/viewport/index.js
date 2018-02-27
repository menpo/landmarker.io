'use strict';

import _ from 'underscore';
import Backbone from 'backbone';
import $ from 'jquery';
import THREE from 'three';

import atomic from '../../model/atomic';
import * as octree from '../../model/octree';

import CameraController from './camera';
import Handler from './handler';
import { LandmarkConnectionTHREEView, LandmarkTHREEView } from './elements';

// clear colour for both the main view and PictureInPicture
const CLEAR_COLOUR = 0xEEEEEE;
const CLEAR_COLOUR_PIP = 0xCCCCCC;

const MESH_MODE_STARTING_POSITION = new THREE.Vector3(1.0, 0.20, 1.5);
const IMAGE_MODE_STARTING_POSITION = new THREE.Vector3(0.0, 0.0, 1.0);

const PIP_WIDTH = 300;
const PIP_HEIGHT = 300;

const MESH_SCALE = 1.0;

export default Backbone.View.extend({

    el: '#canvas',
    id: 'canvas',

    initialize: function () {
        // ----- CONFIGURATION ----- //
        this.meshScale = MESH_SCALE;  // The radius of the mesh's bounding sphere

        // Disable context menu on viewport related elements
        $('canvas').on("contextmenu", function(e){
            e.preventDefault();
        });

        $('#viewportContainer').on("contextmenu", function(e){
            e.preventDefault();
        });

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

        // we need to track the pixel ratio of this device (i.e. is it a
        // HIDPI/retina display?)
        this.pixelRatio = window.devicePixelRatio || 1;

        // Get a hold on the overlay canvas and its context (note we use the
        // id - the Viewport should be passed the canvas element on
        // construction)
        this.canvas = document.getElementById(this.id);
        this.ctx = this.canvas.getContext('2d');

        // we hold a separate canvas for the PIP decoration - grab it
        this.pipCanvas = document.getElementById('pipCanvas');
        this.pipCtx = this.pipCanvas.getContext('2d');

        // style the PIP canvas on initialization
        this.pipCanvas.style.position = 'fixed';
        this.pipCanvas.style.zIndex = 0;
        this.pipCanvas.style.width = PIP_WIDTH + 'px';
        this.pipCanvas.style.height = PIP_HEIGHT + 'px';
        this.pipCanvas.width = PIP_WIDTH * this.pixelRatio;
        this.pipCanvas.height = PIP_HEIGHT * this.pixelRatio;
        this.pipCanvas.style.left = this.pipBounds().x + 'px';

        // To compensate for rentina displays we have to manually
        // scale our contexts up by the pixel ration. To conteract this (so we
        // can work in 'normal' pixel units) add a global transform to the
        // canvas contexts we are holding on to.
        this.pipCtx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
        this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

        // Draw the PIP window - we only do this once.
        this.pipCtx.strokeStyle = '#ffffff';

        // vertical line
        this.pipCtx.beginPath();
        this.pipCtx.moveTo(PIP_WIDTH / 2, PIP_HEIGHT * 0.4);
        this.pipCtx.lineTo(PIP_WIDTH / 2, PIP_HEIGHT * 0.6);
        // horizontal line
        this.pipCtx.moveTo(PIP_WIDTH * 0.4, PIP_HEIGHT / 2);
        this.pipCtx.lineTo(PIP_WIDTH * 0.6, PIP_HEIGHT / 2);
        this.pipCtx.stroke();

        this.pipCtx.setLineDash([2, 2]);
        this.pipCtx.strokeRect(0, 0, PIP_WIDTH, PIP_HEIGHT);

        // hide the pip decoration - should only be shown when in orthgraphic
        // mode.
        this.pipCanvas.style.display = 'none';

        // to be efficient we want to track what parts of the canvas we are
        // drawing into each frame. This way we only need clear the relevant
        // area of the canvas which is a big perf win.
        // see this.updateCanvasBoundingBox() for usage.
        this.ctxBox = this.initialBoundingBox();

        // ------ SCENE GRAPH CONSTRUCTION ----- //
        this.scene = new THREE.Scene();

        // we use an initial top level to handle the absolute positioning of
        // the mesh and landmarks. Rotation and scale are applied to the
        // sMeshAndLms node directly.
        this.sScaleRotate = new THREE.Object3D();
        this.sTranslate = new THREE.Object3D();

        // ----- SCENE: MODEL AND LANDMARKS ----- //
        // sMeshAndLms stores the mesh and landmarks in the meshes original
        // coordinates. This is always transformed to the unit sphere for
        // consistency of camera.
        this.sMeshAndLms = new THREE.Object3D();
        // sLms stores the scene landmarks. This is a useful container to
        // get at all landmarks in one go, and is a child of sMeshAndLms
        this.sLms = new THREE.Object3D();
        this.sMeshAndLms.add(this.sLms);
        // sMesh is the parent of the mesh itself in the THREE scene.
        // This will only ever have one child (the mesh).
        // Child of sMeshAndLms
        this.sMesh = new THREE.Object3D();
        this.sMeshAndLms.add(this.sMesh);
        this.sTranslate.add(this.sMeshAndLms);
        this.sScaleRotate.add(this.sTranslate);
        this.scene.add(this.sScaleRotate);

        // ----- SCENE: CAMERA AND DIRECTED LIGHTS ----- //
        // sCamera holds the camera, and (optionally) any
        // lights that track with the camera as children
        this.sOCam = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 20);
        this.sOCamZoom = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 20);
        this.sPCam = new THREE.PerspectiveCamera(50, 1, 0.02, 20);
        // start with the perspective camera as the main one
        this.sCamera = this.sPCam;

        // create the cameraController to look after all camera state.
        this.cameraController = CameraController(
            this.sPCam, this.sOCam, this.sOCamZoom,
            this.el, this.model.imageMode());

        // when the camera updates, render
        this.cameraController.on('change', this.update);

        if (!this.model.meshMode()) {
            // for images, default to orthographic camera
            // (note that we use toggle to make sure the UI gets updated)
            this.toggleCamera();
        }

        this.resetCamera();

        // ----- SCENE: GENERAL LIGHTING ----- //
        // TODO make lighting customizable
        // TODO no spot light for images
        this.sLights = new THREE.Object3D();
        var pointLightLeft = new THREE.PointLight(0x404040, 1, 0);
        pointLightLeft.position.set(-100, 0, 100);
        this.sLights.add(pointLightLeft);
        var pointLightRight = new THREE.PointLight(0x404040, 1, 0);
        pointLightRight.position.set(100, 0, 100);
        this.sLights.add(pointLightRight);
        this.scene.add(this.sLights);
        // add a soft white ambient light
        this.sLights.add(new THREE.AmbientLight(0x404040));

        this.renderer = new THREE.WebGLRenderer(
            { antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        this.renderer.setClearColor(CLEAR_COLOUR, 1);
        this.renderer.autoClear = false;
        // attach the render on the element we picked out earlier
        this.$webglel.html(this.renderer.domElement);

        // we  build a second scene for various helpers we may need
        // (intersection planes) and for connectivity information (so it
        // shows through)
        this.sceneHelpers = new THREE.Scene();

        // sLmsConnectivity is used to store the connectivity representation
        // of the mesh. Note that we want
        this.sLmsConnectivity = new THREE.Object3D();
        // we want to replicate the mesh scene graph in the scene helpers, so we can
        // have show-though connectivity..
        this.shScaleRotate = new THREE.Object3D();
        this.sHTranslate = new THREE.Object3D();
        this.shMeshAndLms = new THREE.Object3D();
        this.shMeshAndLms.add(this.sLmsConnectivity);
        this.sHTranslate.add(this.shMeshAndLms);
        this.shScaleRotate.add(this.sHTranslate);
        this.sceneHelpers.add(this.shScaleRotate);

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
        this.listenTo(this.model, 'newMeshAvailable', this.changeMesh);
        this.listenTo(this.model, "change:landmarks", () => {
            this.changeLandmarks()
            // window.location.reload();
            // this.changeMesh();
        });

        this.showConnectivity = true;
        this.listenTo(
            this.model,
            'change:connectivityOn',
            this.updateConnectivityDisplay
        );
        this.updateConnectivityDisplay();

        this.listenTo(
            this.model, 'change:editingOn', this.updateEditingDisplay);
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

        this.$container.on('groupSelected', () => {
            this._handler.setGroupSelected(true);
        });

        this.$container.on('groupDeselected', () => {
            this._handler.setGroupSelected(false);
        });

        this.$container.on('completeGroupSelection', () => {
            this._handler.completeGroupSelection();
        });

        this.$container.on('resetCamera', () => {
            this.resetCamera();
        });

        //redraw listener
        this.changeDotFlagListener = _.extend({}, Backbone.Events);
        this.changeDotFlagListener.listenTo(Backbone, 'redrawDots', (lm)=>{
            this.redrawFlaggedLandmarks(lm)
        });
        this.changeDotFlagListener.listenTo(Backbone, 'preventDeselectChanging', (lm)=>{
            this.preventDeselectChanging(lm)
        });
        this.changeDotFlagListener.listenTo(Backbone, 'redrawPreset', ()=>{
            this.changeLandmarks();
        });


        //Change preset form

        document.getElementById("orientation-select").addEventListener("change", function(){
            $('#choosepreset-button').slideDown();
            if($('#orientation-select').val() == '1'){
                $('#contour-select').html('<option value="cycle" selected="selected">Cycle</option>')
                $('#points-select').html('<option value="36" selected="selected">36</option><option value="37">37</option>')
            } else if($('#orientation-select').val() == '0') {
                $('#contour-select').html('<option value="cycle" selected="selected">Cycle</option><option value="circuit">Circuit</option>')
                $('#points-select').html('<option value="49" selected="selected">49</option>')
            }
        });
        document.getElementById("contour-select").addEventListener("change", function(){
            if($('#orientation-select').val() == '1' && $('#contour-select').val() == 'cycle'){
                $('#points-select').html('<option value="36" selected="selected">36</option><option value="37">37</option>')
            } else if($('#orientation-select').val() == '0' && $('#contour-select').val() == 'cycle') {
                $('#points-select').html('<option value="49" selected="selected">49</option>')
            } else if($('#orientation-select').val() == '0' && $('#contour-select').val() == 'circuit'){
                $('#points-select').html('<option value="59" selected="selected">59</option>')
            }
        });

        // document.getElementById("points-select").addEventListener("change", function(){
        //     //in case of new items will added
        // });



        var that = this;
        this.changePresetListener = _.extend({}, Backbone.Events);

        $("#changepreset-button").click(function(){
            if( $('.ChoosePreset-wrapper').css('display') == 'none'){
                $('.ChoosePreset-wrapper').slideDown();
                $("#changepreset-button").html('CLOSE [x]');
            } else {
                $('.ChoosePreset-wrapper').slideUp();
                $("#changepreset-button").html('CHANGE PRESET');

            }
        })
        $("#choosepreset-button").click(function(){
            var obj = {
                orientation: $('#orientation-select').val(),
                contour:  $('#contour-select').val(),
                points:  $('#points-select').val()
            };


            that.model.goToAssetIndex($('#orientation-select').val())

            that.changePresetListener.listenTo(Backbone, 'changePreset', ()=>{
                that.changePresetSetDots(obj)
            });

            $('.ChoosePreset-wrapper').slideUp();
            $("#changepreset-button").html('CHANGE PRESET');

        });

    },

    width: function () {
        return this.$container[0].offsetWidth;
    },

    height: function () {
        return this.$container[0].offsetHeight;
    },

    changeMesh: function () {
        var meshPayload, mesh, up, front;
        console.log('Viewport:changeMesh - memory before: ' + this.memoryString());
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

        this.sMesh.add(mesh);
        // Now we need to rescale the sMeshAndLms to fit in the unit sphere
        // First, the scale
        this.meshScale = mesh.geometry.boundingSphere.radius;
        var s = 1.0 / this.meshScale;
        this.sScaleRotate.scale.set(s, s, s);
        this.shScaleRotate.scale.set(s, s, s);
        this.sScaleRotate.up.copy(up);
        this.shScaleRotate.up.copy(up);
        this.sScaleRotate.lookAt(front.clone());
        this.shScaleRotate.lookAt(front.clone());
        // translation
        var t = mesh.geometry.boundingSphere.center.clone();
        t.multiplyScalar(-1.0);
        this.sTranslate.position.copy(t);
        this.sHTranslate.position.copy(t);
        this.update();
    },

    removeMeshIfPresent: function () {
        if (this.mesh !== null) {
            this.sMesh.remove(this.mesh);
            this.mesh = null;
            this.octree = null;
        }
    },

    memoryString: function () {
        return 'geo:' + this.renderer.info.memory.geometries +
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
        w = this.width();
        h = this.height();
        this.renderer.setViewport(0, 0, w, h);
        this.renderer.setScissor(0, 0, w, h);
        this.renderer.enableScissorTest(true);
        this.renderer.clear();
        this.renderer.render(this.scene, this.sCamera);

        if (this.showConnectivity) {
            this.renderer.clearDepth(); // clear depth buffer
            // and render the connectivity

            this.renderer.render(this.sceneHelpers, this.sCamera);
        }

        // 2. Render the PIP image if in orthographic mode
        if (this.sCamera === this.sOCam) {

            var b = this.pipBounds();
            this.renderer.setClearColor(CLEAR_COLOUR_PIP, 1);
            this.renderer.setViewport(b.x, b.y, b.width, b.height);
            this.renderer.setScissor(b.x, b.y, b.width, b.height);
            this.renderer.enableScissorTest(true);
            this.renderer.clear();
            // render the PIP image
            this.renderer.render(this.scene, this.sOCamZoom);
            if (this.showConnectivity) {
                this.renderer.clearDepth(); // clear depth buffer
                // and render the connectivity
                this.renderer.render(this.sceneHelpers, this.sOCamZoom);
            }
            this.renderer.setClearColor(CLEAR_COLOUR, 1);
        }
    },

    toggleCamera: function () {
        // check what the current setting is
        var currentlyPerspective = (this.sCamera === this.sPCam);
        if (currentlyPerspective) {
            // going to orthographic - start listening for pip updates
            this.listenTo(this.cameraController, "changePip", this.update);
            this.sCamera = this.sOCam;
            // hide the pip decoration
            this.pipCanvas.style.display = null;
        } else {
            // leaving orthographic - stop listening to pip calls.
            this.stopListening(this.cameraController, "changePip");
            this.sCamera = this.sPCam;
            // show the pip decoration
            this.pipCanvas.style.display = 'none';
        }
        // clear the canvas and re-render our state
        this.clearCanvas();
        this.update();
    },

    pipBounds: function () {
        var w = this.width();
        var h = this.height();
        var maxX = w;
        var maxY = h;
        var minX = maxX - PIP_WIDTH;
        var minY = maxY - PIP_HEIGHT;
        return {x: minX, y: minY, width: PIP_WIDTH, height: PIP_HEIGHT};
    },

    resetCamera: function () {
        // reposition the cameras and focus back to the starting point.
        const v = this.model.meshMode() ? MESH_MODE_STARTING_POSITION :
            IMAGE_MODE_STARTING_POSITION;
        this.cameraController.reset(
            v, this.scene.position, this.model.meshMode());
        this.update();
    },

    // Event Handlers
    // =========================================================================

    events: {
        'mousedown': "mousedownHandler"
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
        const lms = this.model.get('landmarks');
        if (lms) {
            lms.deselectAll();
        }
    },

    resize: function () {
        var w, h;
        w = this.width();
        h = this.height();

        // ask the camera controller to update the cameras appropriately
        this.cameraController.resize(w, h);
        // update the size of the renderer and the canvas
        this.renderer.setSize(w, h);

        // scale the canvas and change its CSS width/height to make it high res.
        // note that this means the canvas will be 2x the size of the screen
        // with 2x displays - that's OK though, we know this is a FullScreen
        // CSS class and so will be made to fit in the existing window by other
        // constraints.
        this.canvas.width = w * this.pixelRatio;
        this.canvas.height = h * this.pixelRatio;

        // make sure our global transform for the general context accounts for
        // the pixelRatio
        this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

        // move the pipCanvas to the right place
        this.pipCanvas.style.left = this.pipBounds().x + 'px';
        this.update();
    },

    batchHandler: function (dispatcher) {
        if (dispatcher.atomicOperationFinished()) {
            // just been turned off - trigger an update.
            this.update();
        }
    },


    preventDeselectChanging: atomic.atomicOperation(function (landmark){
        var that = this;;
        var landmarks = this.model.get('landmarks');
        if (landmarks === null) {
            return;
        }

        //setting new dot
        that.landmarkViews[landmark.attributes.index] = new LandmarkTHREEView(
            {
                model: landmark,
                viewport: that
            }
        );

    }),

    changePresetSetDots: function (obj) {
        this.changePresetListener.stopListening();
        this.model.landmarks().setPreset(obj);

    },
    redrawFlaggedLandmarks: atomic.atomicOperation(function (landmark) {

        //redraw 1 dot and 2(or 1) connectivities depends on flag

        var that = this;

        var landmarks = this.model.get('landmarks');
        var viewportChange = that.landmarkViews[landmark.attributes.index].viewport
        if (landmarks === null) {
            return;
        }

        //setting new dot
        that.landmarkViews.splice(landmark.attributes.index, 1,  new LandmarkTHREEView(
            {
                model: landmark,
                viewport: viewportChange
            }
        ));

        // UNCOMMENT IN CASE OF CONNECTIVITY SHOULD BE ANOTHER COLOR + IN ../elements.js

        // //detecting connectivity of lines
        // if(that.connectivityViews){
        // var line1 = _.find(that.connectivityViews, (cnv)=>{
        //     if(cnv){
        //         return cnv.model[0] == landmark;
        //     }
        //     });
        // var line2 = _.find(that.connectivityViews, (cnv)=>{
        //     if(cnv){
        //         return cnv.model[1] == landmark;
        //     }
        //     });
        // }
        // //setting new connectivity
        // if(line1){
        //     that.connectivityViews.splice(that.connectivityViews.indexOf(line1), 1, new LandmarkConnectionTHREEView(
        //         {
        //             model: [landmark,
        //                     line1.model[1]],
        //             viewport: viewportChange
        //         }
        //     ))

        // }
        // if(line2){
        //     that.connectivityViews.splice(that.connectivityViews.indexOf(line2), 1, new LandmarkConnectionTHREEView(
        //         {
        //             model: [line2.model[0],
        //                 landmark],
        //             viewport: viewportChange
        //         }
        //     ))
        // }

        Backbone.on('changeStatusInToolbar', function() {} );
        Backbone.trigger('changeStatusInToolbar', landmark);
        this.changePresetListener.stopListening();
    }),

    changeLandmarks: atomic.atomicOperation(function () {
        // this.changeDotFlagListener.stopListening();
        console.log('Viewport: landmarks have changed');
        var that = this;;
        //hardcode to clean shit up
        this.sLms.children = []
        this.sLmsConnectivity.children = []

        // 1. Dispose of all landmark and connectivity views
        _.map(this.landmarkViews, function (lmView) {
            if(lmView){
                lmView.dispose();
            }
        });
        _.map(this.connectivityViews, function (connView) {
            if(connView){
                connView.dispose();
            }
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
        if(landmarks.landmarks){
        landmarks.landmarks.map(function (lm) {
            that.landmarkViews.push(new LandmarkTHREEView(
                {
                    model: lm,
                    viewport: that
                }));
        });

        landmarks.connectivity.map(function (ab) {
            that.connectivityViews.push(new LandmarkConnectionTHREEView(
                {
                    model: [landmarks.landmarks[ab[0]],
                        landmarks.landmarks[ab[1]]],
                    viewport: that
                }));
        });
    }

        Backbone.on('changePreset', function() {} );
        Backbone.trigger('changePreset');
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
        if (_.isEqual(this.ctxBox, this.initialBoundingBox())) {
            // there has been no change to the canvas - no need to clear
            return null;
        }
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
        this.ctxBox = this.initialBoundingBox();
    },

    initialBoundingBox: function () {
        return {minX: 999999, minY: 999999, maxX: 0, maxY: 0};
    },

    // Coordinates and intersection helpers
    // =========================================================================

    getIntersects: function (x, y, object) {
        if (object === null || object.length === 0) {
            return [];
        }
        var vector = new THREE.Vector3((x / this.width()) * 2 - 1,
            -(y / this.height()) * 2 + 1, 0.5);

        if (this.sCamera === this.sPCam) {
            // perspective selection
            vector.setZ(0.5);
            vector.unproject(this.sCamera);
            this.ray.set(this.sCamera.position, vector.sub(this.sCamera.position).normalize());
        } else {
            // orthographic selection
            vector.setZ(-1);
            vector.unproject(this.sCamera);
            var dir = new THREE.Vector3(0, 0, -1)
                .transformDirection(this.sCamera.matrixWorld);
            this.ray.set(vector, dir);
        }

        if (object === this.mesh && this.octree) {
            // we can use the octree to intersect the mesh efficiently.
            return octree.intersectMesh(this.ray, this.mesh, this.octree);
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
        var widthHalf = this.width() / 2;
        var heightHalf = this.height() / 2;
        var result = vector.project(this.sCamera);
        result.x = (result.x * widthHalf) + widthHalf;
        result.y = -(result.y * heightHalf) + heightHalf;
        return result;
    },

    localToScreen: function (vector) {
        return this.worldToScreen(
            this.sMeshAndLms.localToWorld(vector.clone()));
    },

    worldToLocal: function (vector, inPlace=false) {
        return inPlace ? this.sMeshAndLms.worldToLocal(vector) :
            this.sMeshAndLms.worldToLocal(vector.clone());
    },

    lmToScreen: function (lmSymbol) {
        var pos = lmSymbol.position.clone();
        this.sMeshAndLms.localToWorld(pos);
        return this.worldToScreen(pos);
    },

    lmViewsInSelectionBox: function (x1, y1, x2, y2) {
        var c;
        var lmsInBox = [];
        var that = this;;
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
        return iMesh.length === 0 || iMesh[0].distance > iLm[0].distance;
    }

});
