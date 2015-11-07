'use strict';

import _ from 'underscore';
import $ from 'jquery';
import THREE from 'three';

import atomic from '../../model/atomic';
import * as octree from '../../model/octree';
import store from '../../store';

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


function _initialBoundingBox() {
    return {minX: 999999, minY: 999999, maxX: 0, maxY: 0};
}


//function updateViewport(viewport, state) {
//    viewport.state = state;
//    viewport.update();
//}
//updateViewport(this, store.getState());
//store.subscribe(()=> updateViewport(this, store.getState()));

//
//return {
//    onLandmarksDeleted: null,
//    onLandmarksInserted: null,
//    onLandmarksMoved: null,
//    moveLandmarks: null,
//    deleteLandmarks: null,
//    insertLandmarks: null,
//    setLandmarksSize: null,
//    setTexture: null,
//    setPIPWindow: null,
//    resetCamera: null
//};


export default class BackboneViewport {

    constructor(app) {
        this.model = app;
        this.viewport = new ViewportRedux(app, app.meshMode());

        this.model.on('newMeshAvailable', this.setMesh);
        this.setMesh();

        this.model.on('change:connectivityOn', this.setConnectivityDisplay);
        this.setConnectivityDisplay();

        this.model.on('change:_editingOn', this.setSnapMode);
        this.setSnapMode();

        this.model.on("change:landmarks", this.setLandmarks);

        this.model.on("change:landmarkSize", this.setLandmarkSize);

    }

    setMesh = () => {
        const meshPayload = this.model.mesh();
        if (meshPayload === null) {
            return;
        }
        this.viewport.setMesh(meshPayload.mesh, meshPayload.up, meshPayload.front);
    };

    setLandmarks = () => {
        const landmarks = this.model.landmarks();
        if (landmarks !== null) {
            this.viewport.setLandmarks(landmarks);
        }
    };

    setConnectivityDisplay = () => {
        this.viewport.updateConnectivityDisplay(this.model.isConnectivityOn());
    };

    setSnapMode = () => {
        this.viewport.updateEditingDisplay(this.model.isEditingOn());
    };

    setLandmarkSize = () => {
        this.viewport.setLandmarkSize((this.model.landmarkSize()));
    }

}

class ViewportRedux {

    constructor(app, meshMode) {

        this.meshMode = meshMode;
        this.connectivityOn = true;
        this.model = app;  // only place this is referenced now is in the LandmarkViews we create.
        this.el = document.getElementById('canvas');
        this.$el = $('#canvas');

        // ----- CONFIGURATION ----- //
        this._meshScale = MESH_SCALE;  // The radius of the mesh's bounding sphere

        // Disable context menu on viewport related elements
        $('canvas').on("contextmenu", function(e){
            e.preventDefault();
        });

        $('#viewportContainer').on("contextmenu", function(e){
            e.preventDefault();
        });

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
        this.$container = $('#viewportContainer')
        // and grab the viewport div
        this.$webglel = $('#viewport');

        // we need to track the pixel ratio of this device (i.e. is it a
        // HIDPI/retina display?)
        this._pixelRatio = window.devicePixelRatio || 1;

        // Get a hold on the overlay canvas and its context (note we use the
        // id - the Viewport should be passed the canvas element on
        // construction)
        this._canvas = document.getElementById('canvas');
        this._ctx = this._canvas.getContext('2d');

        // we hold a separate canvas for the PIP decoration - grab it
        this._pipCanvas = document.getElementById('pipCanvas');
        this._pipCtx = this._pipCanvas.getContext('2d');

        // style the PIP canvas on initialization
        this._pipCanvas.style.position = 'fixed';
        this._pipCanvas.style.zIndex = 0;
        this._pipCanvas.style.width = PIP_WIDTH + 'px';
        this._pipCanvas.style.height = PIP_HEIGHT + 'px';
        this._pipCanvas.width = PIP_WIDTH * this._pixelRatio;
        this._pipCanvas.height = PIP_HEIGHT * this._pixelRatio;
        this._pipCanvas.style.left = this._pipBounds().x + 'px';

        // To compensate for retina displays we have to manually
        // scale our contexts up by the pixel ratio. To counteract this (so we
        // can work in 'normal' pixel units) add a global transform to the
        // canvas contexts we are holding on to.
        this._pipCtx.setTransform(this._pixelRatio, 0, 0, this._pixelRatio, 0, 0);
        this._ctx.setTransform(this._pixelRatio, 0, 0, this._pixelRatio, 0, 0);

        // Draw the PIP window - we only do this once.
        this._pipCtx.strokeStyle = '#ffffff';

        // vertical line
        this._pipCtx.beginPath();
        this._pipCtx.moveTo(PIP_WIDTH / 2, PIP_HEIGHT * 0.4);
        this._pipCtx.lineTo(PIP_WIDTH / 2, PIP_HEIGHT * 0.6);
        // horizontal line
        this._pipCtx.moveTo(PIP_WIDTH * 0.4, PIP_HEIGHT / 2);
        this._pipCtx.lineTo(PIP_WIDTH * 0.6, PIP_HEIGHT / 2);
        this._pipCtx.stroke();

        this._pipCtx.setLineDash([2, 2]);
        this._pipCtx.strokeRect(0, 0, PIP_WIDTH, PIP_HEIGHT);

        // hide the pip decoration - should only be shown when in orthgraphic
        // mode.
        this._pipCanvas.style.display = 'none';

        // to be efficient we want to track what parts of the canvas we are
        // drawing into each frame. This way we only need clear the relevant
        // area of the canvas which is a big perf win.
        // see this._updateCanvasBoundingBox() for usage.
        this._ctxBox = _initialBoundingBox();

        // ------ SCENE GRAPH CONSTRUCTION ----- //
        this._scene = new THREE.Scene();

        // we use an initial top level to handle the absolute positioning of
        // the mesh and landmarks. Rotation and scale are applied to the
        // _sMeshAndLms node directly.
        this._sScaleRotate = new THREE.Object3D();
        this._sTranslate = new THREE.Object3D();

        // ----- SCENE: MODEL AND LANDMARKS ----- //
        // _sMeshAndLms stores the mesh and landmarks in the meshes original
        // coordinates. This is always transformed to the unit sphere for
        // consistency of camera.
        this._sMeshAndLms = new THREE.Object3D();
        // _sLms stores the scene landmarks. This is a useful container to
        // get at all landmarks in one go, and is a child of _sMeshAndLms
        this._sLms = new THREE.Object3D();
        this._sMeshAndLms.add(this._sLms);
        // _sMesh is the parent of the mesh itself in the THREE scene.
        // This will only ever have one child (the mesh).
        // Child of _sMeshAndLms
        this._sMesh = new THREE.Object3D();
        this._sMeshAndLms.add(this._sMesh);
        this._sTranslate.add(this._sMeshAndLms);
        this._sScaleRotate.add(this._sTranslate);
        this._scene.add(this._sScaleRotate);

        // ----- SCENE: CAMERA AND DIRECTED LIGHTS ----- //
        // _sCamera holds the camera, and (optionally) any
        // lights that track with the camera as children
        this._sOCam = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 20);
        this._sOCamZoom = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 20);
        this._sPCam = new THREE.PerspectiveCamera(50, 1, 0.02, 20);
        // start with the perspective camera as the main one
        this._sCamera = this._sPCam;

        // create the cameraController to look after all camera state.
        this.cameraController = CameraController(
            this._sPCam, this._sOCam, this._sOCamZoom,
            this.el);

        this.cameraController.onChange = this._update;

        if (!this.meshMode) {
            // for images, default to orthographic camera
            // (note that we use toggle to make sure the UI gets updated)
            this.toggleCamera();
        }

        this.resetCamera();

        // ----- SCENE: GENERAL LIGHTING ----- //
        // TODO make lighting customizable
        // TODO no spot light for images
        this._sLights = new THREE.Object3D();
        const pointLightLeft = new THREE.PointLight(0x404040, 1, 0);
        pointLightLeft.position.set(-100, 0, 100);
        this._sLights.add(pointLightLeft);
        const pointLightRight = new THREE.PointLight(0x404040, 1, 0);
        pointLightRight.position.set(100, 0, 100);
        this._sLights.add(pointLightRight);
        this._scene.add(this._sLights);
        // add a soft white ambient light
        this._sLights.add(new THREE.AmbientLight(0x404040));

        this._renderer = new THREE.WebGLRenderer(
            { antialias: false, alpha: false });
        this._renderer.setPixelRatio(window.devicePixelRatio || 1);
        this._renderer.setClearColor(CLEAR_COLOUR, 1);
        this._renderer.autoClear = false;
        // attach the render on the element we picked out earlier
        this.$webglel.html(this._renderer.domElement);

        // we  build a second scene for various helpers we may need
        // (intersection planes) and for connectivity information (so it
        // shows through)
        this._sceneHelpers = new THREE.Scene();

        // _sLmsConnectivity is used to store the connectivity representation
        // of the mesh. Note that we want
        this._sLmsConnectivity = new THREE.Object3D();
        // we want to replicate the mesh scene graph in the scene helpers, so we can
        // have show-though connectivity..
        this._shScaleRotate = new THREE.Object3D();
        this._sHTranslate = new THREE.Object3D();
        this._shMeshAndLms = new THREE.Object3D();
        this._shMeshAndLms.add(this._sLmsConnectivity);
        this._sHTranslate.add(this._shMeshAndLms);
        this._shScaleRotate.add(this._sHTranslate);
        this._sceneHelpers.add(this._shScaleRotate);

        // store the views that we will later create
        this._landmarkViews = [];
        this._connectivityViews = [];

        // Tools for moving between screen and world coordinates
        this._ray = new THREE.Raycaster();

        // ----- MOUSE HANDLER ----- //
        // There is quite a lot of finicky state in handling the mouse
        // interaction which is of no concern to the rest of the viewport.
        // We wrap all this complexity up in a closure so it can enjoy access
        // to the general viewport state without leaking it's state all over
        // the place.
        this._handler = new Handler(this, app);
        this.el.addEventListener('mousedown', this._handler.onMouseDown);

        // ----- BIND HANDLERS ----- //
        window.addEventListener('resize', this._resize, false);
        // trigger resize to initially size the viewport
        // this will also clearCanvas (will draw context box if needed)
        this._resize();

        // TODO this probably goes away
        atomic.on("change:ATOMIC_OPERATION", this._batchHandler);

        // register for the animation loop
        animate();

        function animate() {
            requestAnimationFrame(animate);
            // uncomment to monitor FPS performance
            //stats.update();
        }

        // TODO remove these jquery events
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
    }

    setLandmarks = atomic.atomicOperation((landmarks) => {
        console.log('Viewport: landmarks have changed');
        var that = this;

        // 1. Dispose of all landmark and connectivity views
        this._landmarkViews.map((lmView) => lmView.dispose());
        this._connectivityViews.map((connView) => connView.dispose());

        // 2. Build a fresh set of views - clear any existing views
        this._landmarkViews = [];
        this._connectivityViews = [];

        landmarks.landmarks.map(function (lm) {
            that._landmarkViews.push(new LandmarkTHREEView(
                {
                    model: lm,
                    viewport: that
                }));
        });
        landmarks.connectivity.map(function (ab) {
            that._connectivityViews.push(new LandmarkConnectionTHREEView(
                {
                    model: [landmarks.landmarks[ab[0]],
                        landmarks.landmarks[ab[1]]],
                    viewport: that
                }));
        });

    });

    setMesh = (mesh, up, front) => {
        console.log('Viewport:setMesh - memory before: ' + this.memoryString());
        // firstly, remove any existing mesh
        this.removeMeshIfPresent();

        this.mesh = mesh;

        if (mesh.geometry instanceof THREE.BufferGeometry) {
            // octree only makes sense if we are dealing with a true mesh
            // (not images). Such meshes are always BufferGeometry instances.
            this.octree = octree.octreeForBufferGeometry(mesh.geometry);
        }

        this._sMesh.add(mesh);
        // Now we need to rescale the _sMeshAndLms to fit in the unit sphere
        // First, the scale
        this._meshScale = mesh.geometry.boundingSphere.radius;
        var s = 1.0 / this._meshScale;
        this._sScaleRotate.scale.set(s, s, s);
        this._shScaleRotate.scale.set(s, s, s);
        this._sScaleRotate.up.copy(up);
        this._shScaleRotate.up.copy(up);
        this._sScaleRotate.lookAt(front.clone());
        this._shScaleRotate.lookAt(front.clone());
        // translation
        var t = mesh.geometry.boundingSphere.center.clone();
        t.multiplyScalar(-1.0);
        this._sTranslate.position.copy(t);
        this._sHTranslate.position.copy(t);
        this._update();
    };

    setLandmarkSize = (lmSize) => {
        this._landmarkViews.map(v => v.setLandmarkSize(lmSize));
    };

    removeMeshIfPresent = () => {
        if (this.mesh !== null) {
            this._sMesh.remove(this.mesh);
            this.mesh = null;
            this.octree = null;
        }
    };

    memoryString = () => {
        return 'geo:' + this._renderer.info.memory.geometries +
               ' tex:' + this._renderer.info.memory.textures +
               ' prog:' + this._renderer.info.memory.programs;
    };

    toggleCamera = () => {
        // check what the current setting is
        var currentlyPerspective = (this._sCamera === this._sPCam);
        if (currentlyPerspective) {
            // going to orthographic - start listening for pip updates
            this.cameraController.onChangePip = this._update;
            this._sCamera = this._sOCam;
            // hide the pip decoration
            this._pipCanvas.style.display = null;
        } else {
            // leaving orthographic - stop listening to pip calls.
            this.cameraController.onChangePip = null;
            this._sCamera = this._sPCam;
            // show the pip decoration
            this._pipCanvas.style.display = 'none';
        }
        // clear the canvas and re-render our state
        this._clearCanvas();
        this._update();
    };

    resetCamera = () => {
        // reposition the cameras and focus back to the starting point.
        const v = this.meshMode ? MESH_MODE_STARTING_POSITION :
            IMAGE_MODE_STARTING_POSITION;
        this.cameraController.reset(
            v, this._scene.position, this.meshMode);
        this._update();
    };

    updateConnectivityDisplay = (isConnectivityOn) => {
        this.connectivityOn = isConnectivityOn;
        this._update();
    };

    updateEditingDisplay = atomic.atomicOperation((isEditModeOn) => {
        this._editingOn = isEditModeOn;
        this._clearCanvas();
        this._handler.setGroupSelected(false);

        // Manually bind to avoid useless function call (even with no effect)
        if (this._editingOn) {
            this.$el.on('mousemove', this._handler.onMouseMove);
        } else {
            this.$el.off('mousemove', this._handler.onMouseMove);
        }
    });

    _width = () => {
        return this.$container[0].offsetWidth;
    };

    _height = () => {
        return this.$container[0].offsetHeight;
    };

    // this is called whenever there is a state change on the THREE _scene
    _update = () => {
        if (!this._renderer) {
            return;
        }
        // if in batch mode - noop.
        if (atomic.atomicOperationUnderway()) {
            return;
        }
        //console.log('Viewport:update');
        // 1. Render the main viewport
        var w, h;
        w = this._width();
        h = this._height();
        this._renderer.setViewport(0, 0, w, h);
        this._renderer.setScissor(0, 0, w, h);
        this._renderer.enableScissorTest(true);
        this._renderer.clear();
        this._renderer.render(this._scene, this._sCamera);

        if (this.connectivityOn) {
            this._renderer.clearDepth(); // clear depth buffer
            // and render the connectivity
            this._renderer.render(this._sceneHelpers, this._sCamera);
        }

        // 2. Render the PIP image if in orthographic mode
        if (this._sCamera === this._sOCam) {
            var b = this._pipBounds();
            this._renderer.setClearColor(CLEAR_COLOUR_PIP, 1);
            this._renderer.setViewport(b.x, b.y, b.width, b.height);
            this._renderer.setScissor(b.x, b.y, b.width, b.height);
            this._renderer.enableScissorTest(true);
            this._renderer.clear();
            // render the PIP image
            this._renderer.render(this._scene, this._sOCamZoom);
            if (this.connectivityOn) {
                this._renderer.clearDepth(); // clear depth buffer
                // and render the connectivity
                this._renderer.render(this._sceneHelpers, this._sOCamZoom);
            }
            this._renderer.setClearColor(CLEAR_COLOUR, 1);
        }
    };

    _pipBounds = () => {
        var w = this._width();
        var h = this._height();
        var maxX = w;
        var maxY = h;
        var minX = maxX - PIP_WIDTH;
        var minY = maxY - PIP_HEIGHT;
        return {x: minX, y: minY, width: PIP_WIDTH, height: PIP_HEIGHT};
    };

    _resize = () => {
        var w, h;
        w = this._width();
        h = this._height();

        // ask the camera controller to update the cameras appropriately
        this.cameraController.resize(w, h);
        // update the size of the renderer and the canvas
        this._renderer.setSize(w, h);

        // scale the canvas and change its CSS width/height to make it high res.
        // note that this means the canvas will be 2x the size of the screen
        // with 2x displays - that's OK though, we know this is a FullScreen
        // CSS class and so will be made to fit in the existing window by other
        // constraints.
        this._canvas.width = w * this._pixelRatio;
        this._canvas.height = h * this._pixelRatio;

        // make sure our global transform for the general context accounts for
        // the pixelRatio
        this._ctx.setTransform(this._pixelRatio, 0, 0, this._pixelRatio, 0, 0);

        // move the _pipCanvas to the right place
        this._pipCanvas.style.left = this._pipBounds().x + 'px';
        this._update();
    };

    _batchHandler = (dispatcher) => {
        if (dispatcher.atomicOperationFinished()) {
            // just been turned off - trigger an update.
            this._update();
        }
    };

    // 2D Canvas helper functions
    // ========================================================================

    _updateCanvasBoundingBox = (point) => {
        // update the canvas bounding box to account for this new point
        this._ctxBox.minX = Math.min(this._ctxBox.minX, point.x);
        this._ctxBox.minY = Math.min(this._ctxBox.minY, point.y);
        this._ctxBox.maxX = Math.max(this._ctxBox.maxX, point.x);
        this._ctxBox.maxY = Math.max(this._ctxBox.maxY, point.y);
    };

    _drawSelectionBox = (mouseDown, mousePosition) => {
        var x = mouseDown.x;
        var y = mouseDown.y;
        var dx = mousePosition.x - x;
        var dy = mousePosition.y - y;
        this._ctx.strokeRect(x, y, dx, dy);
        // update the bounding box
        this._updateCanvasBoundingBox(mouseDown);
        this._updateCanvasBoundingBox(mousePosition);
    };

    _drawTargetingLines = (point, targetLm, secondaryLms) => {

        this._updateCanvasBoundingBox(point);

        // first, draw the secondary lines
        this._ctx.save();
        this._ctx.strokeStyle = "#7ca5fe";
        this._ctx.setLineDash([5, 15]);

        this._ctx.beginPath();
        secondaryLms.forEach((lm) => {
            var lmPoint = this._localToScreen(lm.point());
            this._updateCanvasBoundingBox(lmPoint);
            this._ctx.moveTo(lmPoint.x, lmPoint.y);
            this._ctx.lineTo(point.x, point.y);
        });
        this._ctx.stroke();
        this._ctx.restore();

        // now, draw the primary line
        this._ctx.strokeStyle = "#01e6fb";

        this._ctx.beginPath();
        const targetPoint = this._localToScreen(targetLm.point());
        this._updateCanvasBoundingBox(targetPoint);
        this._ctx.moveTo(targetPoint.x, targetPoint.y);
        this._ctx.lineTo(point.x, point.y);
        this._ctx.stroke();
    };

    _clearCanvas = () => {
        if (_.isEqual(this._ctxBox, _initialBoundingBox())) {
            // there has been no change to the canvas - no need to clear
            return null;
        }
        // we only want to clear the area of the canvas that we dirtied
        // since the last clear. The _ctxBox object tracks this
        const p = 3;  // padding to be added to bounding box
        const minX = Math.max(Math.floor(this._ctxBox.minX) - p, 0);
        const minY = Math.max(Math.floor(this._ctxBox.minY) - p, 0);
        const maxX = Math.ceil(this._ctxBox.maxX) + p;
        const maxY = Math.ceil(this._ctxBox.maxY) + p;
        const width = maxX - minX;
        const height = maxY - minY;
        this._ctx.clearRect(minX, minY, width, height);
        // reset the tracking of the context bounding box tracking.
        this._ctxBox = _initialBoundingBox();
    };

    // Coordinates and intersection helpers
    // =========================================================================

    _getIntersects = (x, y, object) => {
        if (object === null || object.length === 0) {
            return [];
        }
        const vector = new THREE.Vector3((x / this._width()) * 2 - 1,
                                        -(y / this._height()) * 2 + 1, 0.5);

        if (this._sCamera === this._sPCam) {
            // perspective selection
            vector.setZ(0.5);
            vector.unproject(this._sCamera);
            this._ray.set(this._sCamera.position, vector.sub(this._sCamera.position).normalize());
        } else {
            // orthographic selection
            vector.setZ(-1);
            vector.unproject(this._sCamera);
            var dir = new THREE.Vector3(0, 0, -1)
                .transformDirection(this._sCamera.matrixWorld);
            this._ray.set(vector, dir);
        }

        if (object === this.mesh && this.octree) {
            // we can use the octree to intersect the mesh efficiently.
            return octree.intersectMesh(this._ray, this.mesh, this.octree);
        } else if (object instanceof Array) {
            return this._ray.intersectObjects(object, true);
        } else {
            return this._ray.intersectObject(object, true);
        }
    };

    _getIntersectsFromEvent = (event, object) => {
      return this._getIntersects(event.clientX, event.clientY, object);
    };

    _worldToScreen = (vector) => {
        const widthHalf = this._width() / 2;
        const heightHalf = this._height() / 2;
        const result = vector.project(this._sCamera);
        result.x = (result.x * widthHalf) + widthHalf;
        result.y = -(result.y * heightHalf) + heightHalf;
        return result;
    };

    _localToScreen = (vector) => {
        return this._worldToScreen(
            this._sMeshAndLms.localToWorld(vector.clone()));
    };

    _worldToLocal = (vector, inPlace=false) => {
        return inPlace ? this._sMeshAndLms.worldToLocal(vector) :
                         this._sMeshAndLms.worldToLocal(vector.clone());
    };

    _lmToScreen = (lmSymbol) => {
        const pos = lmSymbol.position.clone();
        this._sMeshAndLms.localToWorld(pos);
        return this._worldToScreen(pos);
    };

    _lmViewsInSelectionBox = (x1, y1, x2, y2) => {
        const lmsInBox = [];
        const that = this;
        this._landmarkViews.map((lmView) => {
            if (lmView.symbol) {
                const c = that._lmToScreen(lmView.symbol);
                if (c.x > x1 && c.x < x2 && c.y > y1 && c.y < y2) {
                    lmsInBox.push(lmView);
                }
            }
        });

        return lmsInBox;
    };

    _lmViewVisible = (lmView) => {
        if (!lmView.symbol) {
            return false;
        }
        var screenCoords = this._lmToScreen(lmView.symbol);
        // intersect the mesh and the landmarks
        var iMesh = this._getIntersects(
            screenCoords.x, screenCoords.y, this.mesh);
        var iLm = this._getIntersects(
            screenCoords.x, screenCoords.y, lmView.symbol);
        // is there no mesh here (pretty rare as landmarks have to be on mesh)
        // or is the mesh behind the landmarks?
        return iMesh.length === 0 || iMesh[0].distance > iLm[0].distance;
    };
}
