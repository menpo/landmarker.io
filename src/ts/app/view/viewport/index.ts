import * as _ from 'underscore'
import * as $ from 'jquery'
import * as THREE from 'three'

import atomic from '../../model/atomic'
import { octreeForBufferGeometry, Octree, Intersection } from './octree'

import { CameraController } from './camera'
import Handler from './handler'
import { LandmarkConnectionTHREEView, LandmarkTHREEView, ViewportElementCallbacks} from './elements'
import { Landmark } from './base'

// clear colour for both the main view and PictureInPicture
const CLEAR_COLOUR = 0xEEEEEE
const CLEAR_COLOUR_PIP = 0xCCCCCC

const MESH_MODE_STARTING_POSITION = new THREE.Vector3(1.0, 0.20, 1.5)
const IMAGE_MODE_STARTING_POSITION = new THREE.Vector3(0.0, 0.0, 1.0)

const PIP_WIDTH = 300
const PIP_HEIGHT = 300

const MESH_SCALE = 1.0

interface BoundingBox {
    minX: number, minY: number, maxX: number, maxY: number
}

type Intersectable = THREE.Object3D | THREE.Object3D[]

function _initialBoundingBox() {
    return { minX: 999999, minY: 999999, maxX: 0, maxY: 0 }
}


export interface ViewportCallbacks {
    selectLandmarks: (indicies: number[]) => void
    deselectLandmarks: (indicies: number[]) => void
    deselectAllLandmarks: () => void
    selectLandmarkAndDeselectRest: (index: number) => void
    setLandmarkPoint: (index: number, point: THREE.Vector) => void
    setLandmarkPointWithHistory: (index: number, point: THREE.Vector) => void
    addLandmarkHistory: (points: THREE.Vector[]) => void
    insertNewLandmark: (point: THREE.Vector) => void
}

// We are trying to move towards the whole viewport module being a standalone black box that
// has no dependencies beyond THREE and our octree. As part of this effort, we refactor out
// the Viewport core code into a standalone class with minimal interaction with Backbone.
export class Viewport {

    on: ViewportCallbacks
    meshMode: boolean   // if true, working with 3D meshes. False, 2D images.
    connectivityOn = true
    _editingOn: boolean

    el: HTMLElement
    $el: JQuery

    $container: JQuery
    $webglel: JQuery

    _canvas: HTMLCanvasElement
    _pipCanvas: HTMLCanvasElement
    _ctx: CanvasRenderingContext2D
    _pipCtx: CanvasRenderingContext2D

    _pixelRatio = window.devicePixelRatio || 1  // 2/3 if on a HIDPI/retina display
    _meshScale = MESH_SCALE  // The radius of the mesh's bounding sphere
    _lmSize = 1

    _ctxBox: BoundingBox

    _scene: THREE.Scene
    _sScaleRotate: THREE.Object3D
    _sTranslate: THREE.Object3D
    _sMeshAndLms: THREE.Object3D
    _sLms: THREE.Object3D
    _sMesh: THREE.Object3D

    _sOCam: THREE.OrthographicCamera
    _sOCamZoom: THREE.OrthographicCamera
    _sPCam: THREE.PerspectiveCamera
    _sCamera: THREE.Camera

    _sLights: THREE.Object3D
    _renderer: THREE.WebGLRenderer

    _sceneHelpers: THREE.Scene
    _sLmsConnectivity: THREE.Object3D
    _shScaleRotate: THREE.Object3D
    _sHTranslate: THREE.Object3D
    _shMeshAndLms: THREE.Object3D

    cameraController: CameraController

    _landmarkViews: LandmarkTHREEView[]
    _connectivityViews: LandmarkConnectionTHREEView[]
    _ray: THREE.Raycaster

    _handler: Handler

    _landmarks: Landmark[]
    _connectivity: [number, number][]

    mesh: THREE.Mesh
    octree: Octree


    constructor(meshMode: boolean, on: ViewportCallbacks) {
        // all our callbacks are stored under the on namespace.
        this.on = on;
        this.meshMode = meshMode;
        this.el = document.getElementById('canvas');
        this.$el = $('#canvas');

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
        this.$container = $('#viewportContainer');
        // and grab the viewport div
        this.$webglel = $('#viewport');

        // Get a hold on the overlay canvas and its context (note we use the
        // id - the Viewport should be passed the canvas element on
        // construction)
        this._canvas = <HTMLCanvasElement> document.getElementById('canvas');
        this._ctx = this._canvas.getContext('2d');

        // we hold a separate canvas for the PIP decoration - grab it
        this._pipCanvas = <HTMLCanvasElement> document.getElementById('pipCanvas');
        this._pipCtx = this._pipCanvas.getContext('2d');

        // style the PIP canvas on initialization
        this._pipCanvas.style.position = 'fixed';
        this._pipCanvas.style.zIndex = '0';
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
        this.cameraController = new CameraController(
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
            { antialias: true, alpha: false })
        this._renderer.setPixelRatio(this._pixelRatio)
        this._renderer.autoClear = false
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
        this._handler = new Handler(this);
        this.el.addEventListener('mousedown', this._handler.onMouseDown);

        // ----- BIND HANDLERS ----- //
        window.addEventListener('resize', this._resize, false);
        // trigger resize to initially size the viewport
        // this will also clearCanvas (will draw context box if needed)
        this._resize();

        // TODO this probably goes away once we remove Backbone from the view
        atomic.on("change:ATOMIC_OPERATION", this._batchHandler);

        // register for the animation loop
        animate();

        function animate() {
            requestAnimationFrame(animate);
            // uncomment to monitor FPS performance
            //stats.update();
        }

        this.$container.on('resetCamera', () => {
            this.resetCamera();
        });
    }

    setLandmarksAndConnectivity = atomic.atomicOperation((landmarks: Landmark[],
                                                          connectivity: [number, number][]) => {
        console.log('Viewport: landmarks have changed');
        this._landmarks = landmarks;
        this._connectivity = connectivity;

        // 1. Dispose of all landmark and connectivity views
        this._landmarkViews.forEach(lmView => lmView.dispose());
        this._connectivityViews.forEach(connView => connView.dispose());

        // 2. Build a fresh set of views
        this._landmarkViews = this._landmarks.map(lm =>
            new LandmarkTHREEView(lm,
                {
                    onCreate: symbol => this._sLms.add(symbol),
                    onDispose: symbol => this._sLms.remove(symbol)
                })
        );
        this._connectivityViews = this._connectivity.map(([a, b]) =>
            new LandmarkConnectionTHREEView(this._landmarks[a], this._landmarks[b],
                {
                    onCreate: symbol => this._sLmsConnectivity.add(symbol),
                    onDispose: symbol => this._sLmsConnectivity.remove(symbol)
                })
        );

        // 3. Reset the handler state
        this._handler.resetLandmarks()

    });

    updateLandmarks = atomic.atomicOperation((landmarks: Landmark[]) => {
        landmarks.forEach(lm => {
            this._landmarks[lm.index] = lm
            this._landmarkViews[lm.index].render(lm)
        })

        // Finally go through all connectivity views and update them
        this._connectivityViews.forEach((view, i) => {
            const [a, b] = this._connectivity[i];
            view.render(this._landmarks[a], this._landmarks[b])
        });

        this._update()
    });

    setMesh = (mesh: THREE.Mesh, up: THREE.Vector3, front: THREE.Vector3) => {
        console.log('Viewport:setMesh - memory before: ' + this.memoryString());
        // firstly, remove any existing mesh
        this.removeMeshIfPresent()
        this.mesh = mesh

        const geometry = mesh.geometry
        if (geometry instanceof THREE.BufferGeometry) {
            // octree only makes sense if we are dealing with a true mesh
            // (not images). Such meshes are always BufferGeometry instances.
            this.octree = octreeForBufferGeometry(geometry)
        }

        this._sMesh.add(mesh)
        // Now we need to rescale the _sMeshAndLms to fit in the unit sphere
        // First, the scale
        this._meshScale = mesh.geometry.boundingSphere.radius;
        const s = 1.0 / this._meshScale
        this._sScaleRotate.scale.set(s, s, s);
        this._shScaleRotate.scale.set(s, s, s);
        this._sScaleRotate.up.copy(up);
        this._shScaleRotate.up.copy(up);
        this._sScaleRotate.lookAt(front.clone());
        this._shScaleRotate.lookAt(front.clone());
        // translation
        const t = mesh.geometry.boundingBox.center().clone();
        t.multiplyScalar(-1.0);
        this._sTranslate.position.copy(t);
        this._sHTranslate.position.copy(t);
        this._update();
    };

    setLandmarkSize = (lmSize: number) => {
        this._lmSize = lmSize
    }

    removeMeshIfPresent = () => {
        if (this.mesh !== null) {
            this._sMesh.remove(this.mesh)
            this.mesh = null
            this.octree = null
        }
    }

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

    updateConnectivityDisplay = (isConnectivityOn: boolean) => {
        this.connectivityOn = isConnectivityOn;
        this._update();
    };

    updateEditingDisplay = atomic.atomicOperation((isEditModeOn: boolean) => {
        this._editingOn = isEditModeOn
        this._clearCanvas()
        this.on.deselectAllLandmarks()

        // Manually bind to avoid useless function call (even with no effect)
        if (this._editingOn) {
            this.$el.on('mousemove', this._handler.onMouseMove);
        } else {
            this.$el.off('mousemove', this._handler.onMouseMove);
        }
    });

    budgeLandmarks = atomic.atomicOperation((vector: number[]) => {

        // Set a movement of 0.5% of the screen in the suitable direction
        const [x, y] = vector,
            move = new THREE.Vector2(),
            [dx, dy] = [.005 * window.innerWidth, .005 * window.innerHeight];

        move.set(x * dx, y * dy);

        const ops = [];
        this._selectedLandmarks.forEach((lm) => {
            const lmScreen = this._localToScreen(lm.point)
            lmScreen.add(move)

            const intersectsWithMesh = this._getIntersects(lmScreen.x, lmScreen.y, this.mesh)

            if (intersectsWithMesh.length > 0) {
                const pt = this._worldToLocal(intersectsWithMesh[0].point);
                ops.push([lm.index, lm.point.clone(), pt.clone()]);
                this.on.setLandmarkPointWithHistory(lm.index, pt);
            }
        });
        this.on.addLandmarkHistory(ops);
    });

    get _hasLandmarks() {
        return this._landmarks !== null && this._landmarks !== undefined
    }

    get _nonEmptyLandmarks() {
        return this._landmarks.filter(lm => lm.point !== null)
    }

    get _selectedLandmarks() {
        return this._landmarks.filter(lm => lm.isSelected)
    }

    get _groupModeActive() {
        return this._selectedLandmarks.length > 1
    }

    get _allLandmarksEmpty() {
        return this._nonEmptyLandmarks.length === 0
    }

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
        // if in batch mode - dont render unnecessarily
        if (atomic.atomicOperationUnderway()) {
            return;
        }

        // 1. Before we do any rendering ensure the landmarks are the right size
        const s = this._lmSize * this._meshScale;
        this._sLms.children.forEach(v => v.scale.x !== s ? v.scale.set(s, s, s) : null);

        // 2. Render the main viewport...
        const w = this._width()
        const h = this._height()
        this._renderer.setViewport(0, 0, w, h)
        this._renderer.setScissorTest(false)
        this._renderer.setClearColor(CLEAR_COLOUR)
        this._renderer.clear()
        this._renderer.render(this._scene, this._sCamera)

        if (this.connectivityOn) {
            // clear depth buffer
            this._renderer.clearDepth();
            // and render the connectivity
            this._renderer.render(this._sceneHelpers, this._sCamera);
        }

        // 3. Render the PIP image if in orthographic mode
        if (this._sCamera === this._sOCam) {
            var b = this._pipBounds()
            this._renderer.setScissor(b.x * this._pixelRatio, b.y * 2, b.width * 2, b.height * 2)
            this._renderer.setScissorTest(true)
            this._renderer.setClearColor(CLEAR_COLOUR_PIP)
            this._renderer.clear()
            this._renderer.setScissorTest(false)

            this._renderer.setViewport(b.x, b.y, b.width, b.height);

            // render the PIP image
            this._renderer.render(this._scene, this._sOCamZoom);
            if (this.connectivityOn) {
                this._renderer.clearDepth(); // clear depth buffer
                // and render the connectivity
                this._renderer.render(this._sceneHelpers, this._sOCamZoom);
            }
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
        const w = this._width()
        const h = this._height()

        // ask the camera controller to update the cameras appropriately
        this.cameraController.resize(w, h)
        // update the size of the renderer and the canvas
        this._renderer.setSize(w, h)

        // scale the canvas and change its CSS width/height to make it high res.
        // note that this means the canvas will be 2x the size of the screen
        // with 2x displays - that's OK though, we know this is a FullScreen
        // CSS class and so will be made to fit in the existing window by other
        // constraints.
        this._canvas.width = w * this._pixelRatio
        this._canvas.height = h * this._pixelRatio

        // make sure our global transform for the general context accounts for
        // the pixelRatio
        this._ctx.setTransform(this._pixelRatio, 0, 0, this._pixelRatio, 0, 0)

        // move the _pipCanvas to the right place
        this._pipCanvas.style.left = this._pipBounds().x + 'px'
        this._update()
    };

    _batchHandler = (dispatcher) => {
        if (dispatcher.atomicOperationFinished()) {
            // just been turned off - trigger an update.
            this._update();
        }
    };

    // 2D Canvas helper functions
    // ========================================================================

    _updateCanvasBoundingBox = (point: THREE.Vector2) => {
        // update the canvas bounding box to account for this new point
        this._ctxBox.minX = Math.min(this._ctxBox.minX, point.x)
        this._ctxBox.minY = Math.min(this._ctxBox.minY, point.y)
        this._ctxBox.maxX = Math.max(this._ctxBox.maxX, point.x)
        this._ctxBox.maxY = Math.max(this._ctxBox.maxY, point.y)
    };

    _drawSelectionBox = (mouseDown: THREE.Vector2, mousePosition: THREE.Vector2) => {
        var x = mouseDown.x;
        var y = mouseDown.y;
        var dx = mousePosition.x - x;
        var dy = mousePosition.y - y;
        this._ctx.strokeRect(x, y, dx, dy);
        // update the bounding box
        this._updateCanvasBoundingBox(mouseDown);
        this._updateCanvasBoundingBox(mousePosition);
    };

    _drawTargetingLines = (point: THREE.Vector2, targetLm: Landmark, secondaryLms: Landmark[]) => {

        this._updateCanvasBoundingBox(point);

        // first, draw the secondary lines
        this._ctx.save();
        this._ctx.strokeStyle = "#7ca5fe";
        this._ctx.setLineDash([5, 15]);

        this._ctx.beginPath();
        secondaryLms.forEach(lm => {
            var lmPoint = this._localToScreen(lm.point);
            this._updateCanvasBoundingBox(lmPoint);
            this._ctx.moveTo(lmPoint.x, lmPoint.y);
            this._ctx.lineTo(point.x, point.y);
        });
        this._ctx.stroke();
        this._ctx.restore();

        // now, draw the primary line
        this._ctx.strokeStyle = "#01e6fb";

        this._ctx.beginPath();
        const targetPoint = this._localToScreen(targetLm.point);
        this._updateCanvasBoundingBox(targetPoint);
        this._ctx.moveTo(targetPoint.x, targetPoint.y);
        this._ctx.lineTo(point.x, point.y);
        this._ctx.stroke();
    };

    _clearCanvas = (): void => {
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

    _getIntersects = (x: number, y: number, object: Intersectable): Intersection[] =>  {
        if (object === null || (object instanceof Array && object.length === 0)) {
            return []
        }
        const vector = new THREE.Vector3((x / this._width()) * 2 - 1,
                                        -(y / this._height()) * 2 + 1, 0.5)

        if (this._sCamera === this._sPCam) {
            // perspective selection
            vector.setZ(0.5)
            vector.unproject(this._sCamera)
            this._ray.set(this._sCamera.position, vector.sub(this._sCamera.position).normalize())
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
            return this.octree.intersectMesh(this._ray, this.mesh)
        } else if (object instanceof Array) {
            return this._ray.intersectObjects(object, true)
        } else {
            return this._ray.intersectObject(object, true);
        }
    };

    _getIntersectsFromEvent = (e: MouseEvent, object: Intersectable) => this._getIntersects(e.clientX, e.clientY, object);

    _worldToScreen = (v: THREE.Vector3) => {
        const halfW = this._width() / 2
        const halfH = this._height() / 2
        const p = v.clone().project(this._sCamera)
        return new THREE.Vector2((p.x * halfW) + halfW, -(p.y * halfH) + halfH)
    }

    _worldToLocal = (v: THREE.Vector3) => this._sMeshAndLms.worldToLocal(v.clone())
    _localToScreen = (v: THREE.Vector3) => this._worldToScreen(this._sMeshAndLms.localToWorld(v.clone()))

    _lmViewsInSelectionBox = (x1: number, y1: number, x2: number, y2: number) =>
        this._landmarkViews.filter(lmv => {
            if (lmv.symbol) {
                const c = this._localToScreen(lmv.symbol.position)
                return c.x > x1 && c.x < x2 && c.y > y1 && c.y < y2
            } else {
                return false
            }
        })

    _lmViewVisible = (lmv: LandmarkTHREEView) => {
        if (lmv.symbol === null) {
            return false
        }
        const screenCoords = this._localToScreen(lmv.symbol.position)
        // intersect the mesh and the landmarks
        const iMesh = this._getIntersects(
            screenCoords.x, screenCoords.y, this.mesh)
        const iLm = this._getIntersects(
            screenCoords.x, screenCoords.y, lmv.symbol)
        // is there no mesh here (pretty rare as landmarks have to be on mesh)
        // or is the mesh behind the landmarks?
        return iMesh.length === 0 || iMesh[0].distance > iLm[0].distance
    }

}
