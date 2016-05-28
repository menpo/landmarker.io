import * as _ from 'underscore'
import * as THREE from 'three'

import { atomic, AtomicOperationTracker } from '../../model/atomic'
import { DomElements } from './dom'
import { Camera, MultiCamManger,
         TouchCameraController,
         MouseCameraController } from './camera'

import Handler from './handler'
import TouchHandler from './touchHandler'

import { Landmark } from './base'
import { ViewportElementCallbacks} from './elements'

import { Scene, SceneManager, CAMERA_MODE } from './scene'

// clear colour for both the main view and PictureInPicture
const CLEAR_COLOUR = 0xEEEEEE
const CLEAR_COLOUR_PIP = 0xCCCCCC

const MESH_MODE_STARTING_POSITION = new THREE.Vector3(1.0, 0.20, 1.5)
const IMAGE_MODE_STARTING_POSITION = new THREE.Vector3(0.0, 0.0, 1.0)

const PIP_WIDTH = 300
const PIP_HEIGHT = 300

interface BoundingBox {
    minX: number, minY: number, maxX: number, maxY: number
}

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

export interface IViewport {
    setLandmarksAndConnectivity: (landmarks: Landmark[], connectivity: [number, number][]) => void
    updateLandmarks: (landmarks: Landmark[]) => void
    setMesh: (mesh: THREE.Mesh, up: THREE.Vector3, front: THREE.Vector3) => void
    removeMeshIfPresent: () => void
    budgeLandmarks: (vector: [number, number]) => void
    setLandmarkSize: (lmSize: number) => void
    snapModeEnabled: boolean
    connectivityVisable: boolean
}

// We are trying to move towards the whole viewport module being a standalone black box that
// has no dependencies beyond THREE and our octree. As part of this effort, we refactor out
// the Viewport core code into a standalone class with minimal interaction with Backbone.
export class Viewport implements IViewport {

    meshMode: boolean   // if true, working with 3D meshes. False, 2D images.

    on: ViewportCallbacks

    _connectivityVisable = true
    _snapModeEnabled: boolean // Note that we need to fire this in the constructor for sideeffects

    parent: HTMLElement
    elements = new DomElements()

    ctx: CanvasRenderingContext2D
    pipCtx: CanvasRenderingContext2D
    ctxBox: BoundingBox

    pixelRatio = window.devicePixelRatio || 1  // 2/3 if on a HIDPI/retina display

    renderer: THREE.WebGLRenderer

    scene: Scene = new SceneManager()
    camera: Camera

    cameraTouchController: TouchCameraController
    cameraMouseController: MouseCameraController

    handler: Handler
    touchHandler: TouchHandler

    constructor(parent: HTMLElement, meshMode: boolean, on: ViewportCallbacks) {

        // all our callbacks are stored under the on namespace.
        this.on = on
        this.meshMode = meshMode

        this.parent = parent
        this.parent.appendChild(this.elements.viewport)

        // Disable context menu on viewport related elements
        this.elements.viewport.addEventListener('contextmenu', e => e.preventDefault())

        this.ctx = this.elements.canvas.getContext('2d')
        this.pipCtx = this.elements.pipCanvas.getContext('2d')

        // style the PIP canvas on initialization
        this.elements.pipCanvas.style.position = 'fixed';
        this.elements.pipCanvas.style.zIndex = '0';
        this.elements.pipCanvas.style.width = PIP_WIDTH + 'px';
        this.elements.pipCanvas.style.height = PIP_HEIGHT + 'px';
        this.elements.pipCanvas.width = PIP_WIDTH * this.pixelRatio;
        this.elements.pipCanvas.height = PIP_HEIGHT * this.pixelRatio;
        this.elements.pipCanvas.style.left = this.pipBounds().x + 'px';

        // To compensate for retina displays we have to manually
        // scale our contexts up by the pixel ratio. To counteract this (so we
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
        this.elements.pipCanvas.style.display = 'none';

        // to be efficient we want to track what parts of the canvas we are
        // drawing into each frame. This way we only need clear the relevant
        // area of the canvas which is a big perf win.
        // see this._updateCanvasBoundingBox() for usage.
        this.ctxBox = _initialBoundingBox();

        // create the camera to look after all camera state.
        this.camera = new MultiCamManger(this.width, this.height,
                                         this.scene.sPCam,
                                         this.scene.sOCam,
                                         this.scene.sOCamZoom)

        this.camera.onChange = this.update
        this.cameraTouchController = new TouchCameraController(this.camera, this.elements.viewport)
        this.cameraMouseController = new MouseCameraController(this.camera, this.elements.viewport)

        if (!this.meshMode) {
            // for images, default to orthographic camera
            // (note that we use toggle to make sure the UI gets updated)
            this.toggleCamera()
        }

        this.resetCamera()

        this.renderer = new THREE.WebGLRenderer(
            {
                antialias: true,
                alpha: false,
                devicePixelRatio: this.pixelRatio,
                canvas: this.elements.webgl
            }
        )
        this.renderer.autoClear = false
        this.renderer.setPixelRatio(this.pixelRatio)

        // ----- INPUT HANDLERS ----- //
        // There is quite a lot of finicky state in handling the mouse/touch
        // interaction which is of no concern to the rest of the viewport.
        this.handler = new Handler(this);
        this.touchHandler = new TouchHandler(this)

        // ----- BIND HANDLERS ----- //
        this.elements.viewport.addEventListener('mousedown', this.handler.onMouseDown);
        this.elements.viewport.addEventListener('touchstart', this.touchHandler.onTouchStart)
        this.elements.viewport.addEventListener('touchmove', this.touchHandler.onTouchMove)
        window.addEventListener('resize', this.resize)

        // trigger resize to initially size the viewport
        // this will also clearCanvas (will draw context box if needed)
        this.resize()

        // TODO this probably goes away once we remove Backbone from the view
        atomic.on("change:ATOMIC_OPERATION", this.onAtomicChange)

        // register for the animation loop
        animate()

        function animate() {
            requestAnimationFrame(animate)
        }

        this.snapModeEnabled = true
    }

    get width() {
        return this.elements.viewport.offsetWidth
    }

    get height() {
        return this.elements.viewport.offsetHeight
    }

    get landmarks() {
        return this.scene.landmarks
    }

    get hasLandmarks() {
        return this.landmarks !== null && this.landmarks !== undefined
    }

    get nonEmptyLandmarks() {
        return this.landmarks.filter(lm => lm.point !== null)
    }

    get selectedLandmarks() {
        return this.landmarks.filter(lm => lm.isSelected)
    }

    get groupModeActive() {
        return this.selectedLandmarks.length > 1
    }

    get allLandmarksEmpty() {
        return this.nonEmptyLandmarks.length === 0
    }

    get connectivityVisable() {
        return this._connectivityVisable
    }

    set connectivityVisable (connectivityVisable: boolean) {
        this._connectivityVisable = connectivityVisable
        this.update()
    }

    get snapModeEnabled () {
        return this._snapModeEnabled
    }

    set snapModeEnabled(snapModeEnabled: boolean) {
        this._snapModeEnabled = snapModeEnabled
        this.clearCanvas()
        this.on.deselectAllLandmarks()
        if (snapModeEnabled) {
            this.elements.viewport.addEventListener('mousemove', this.handler.onMouseMove)
        } else {
            this.elements.viewport.removeEventListener('mousemove', this.handler.onMouseMove)
        }
    }

    // Bring the viewport DOM into focus
    focus = () => {
        this.elements.viewport.focus()
    }

    setLandmarksAndConnectivity = atomic.atomicOperation((landmarks: Landmark[],
                                                          connectivity: [number, number][]) => {
        console.log('Viewport:setLandmarksAndConnectivity')
        this.scene.setLandmarksAndConnectivity(landmarks, connectivity)
        this.handler.resetLandmarks()
    })

    updateLandmarks = atomic.atomicOperation((landmarks: Landmark[]) => {
        this.scene.updateLandmarks(landmarks)
        this.update()
    })

    setMesh = (mesh: THREE.Mesh, up: THREE.Vector3, front: THREE.Vector3) => {
        console.log('Viewport:setMesh - memory before: ' + this.memoryString());
        this.scene.setMesh(mesh, up, front)
        this.update()
    }

    removeMeshIfPresent = () => this.scene.removeMeshIfPresent()

    setLandmarkSize = (lmSize: number) => {
        // setting the lmScale will trigger the nessessary changes.
        this.scene.lmScale = lmSize
        this.update()
    }

    toggleCamera = () => {
        const currentMode = this.scene.cameraMode
        // trigger the changeover of the primary camera
        this.scene.toggleCamera()
        if (currentMode === CAMERA_MODE.PERSPECTIVE) {
            // going to orthographic - start listening for pip updates
            this.camera.onChangePip = this.update
            this.elements.pipVisable = false
        } else {
            // leaving orthographic - stop listening to pip calls.
            this.camera.onChangePip = null
            this.elements.pipVisable = true
        }
        // clear the canvas and re-render our state
        this.clearCanvas()
        this.update()
    }

    resetCamera = () => {
        // reposition the cameras and focus back to the starting point.
        const v = this.meshMode ? MESH_MODE_STARTING_POSITION : IMAGE_MODE_STARTING_POSITION
        this.camera.reset(v, this.scene.scene.position, this.meshMode)
        this.update()
    };

    budgeLandmarks = atomic.atomicOperation((vector: [number, number]) => {

        // Set a movement of 0.5% of the screen in the suitable direction
        const [x, y] = vector,
            move = new THREE.Vector2(),
            [dx, dy] = [.005 * window.innerWidth, .005 * window.innerHeight];

        move.set(x * dx, y * dy);

        const ops = [];
        this.selectedLandmarks.forEach((lm) => {
            const lmScreen = this.scene.localToScreen(lm.point)
            lmScreen.add(move)

            const intersectsWithMesh = this.scene.getIntersects(lmScreen.x, lmScreen.y,
                                                                this.scene.mesh)

            if (intersectsWithMesh.length > 0) {
                const pt = this.scene.worldToLocal(intersectsWithMesh[0].point);
                ops.push([lm.index, lm.point.clone(), pt.clone()]);
                this.on.setLandmarkPointWithHistory(lm.index, pt);
            }
        });
        this.on.addLandmarkHistory(ops);
    });

    // this is called whenever there is a state change on the THREE scene
    update = () => {
        if (!this.renderer) {
            return;
        }
        // if in batch mode - dont render unnecessarily
        if (atomic.atomicOperationUnderway()) {
            return;
        }

        const scene = this.scene

        // 2. Render the main viewport...
        this.renderer.setViewport(0, 0, this.width, this.height)
        this.renderer.setScissorTest(false)
        this.renderer.setClearColor(CLEAR_COLOUR)
        this.renderer.clear()
        this.renderer.render(scene.scene, scene.sCamera)

        if (this.connectivityVisable) {
            // clear depth buffer
            this.renderer.clearDepth();
            // and render the connectivity
            this.renderer.render(scene.sceneHelpers, scene.sCamera);
        }

        // 3. Render the PIP image if in orthographic mode
        if (scene.sCamera === scene.sOCam) {
            var b = this.pipBounds()
            this.renderer.setScissor(b.x * this.pixelRatio, b.y * 2, b.width * 2, b.height * 2)
            this.renderer.setScissorTest(true)
            this.renderer.setClearColor(CLEAR_COLOUR_PIP)
            this.renderer.clear()
            this.renderer.setScissorTest(false)

            this.renderer.setViewport(b.x, b.y, b.width, b.height);

            // render the PIP image
            this.renderer.render(scene.scene, scene.sOCamZoom);
            if (this.connectivityVisable) {
                this.renderer.clearDepth(); // clear depth buffer
                // and render the connectivity
                this.renderer.render(scene.sceneHelpers, scene.sOCamZoom);
            }
        }
    }

    memoryString = () => {
        return 'geo:' + this.renderer.info.memory.geometries +
               ' tex:' + this.renderer.info.memory.textures
    }


    pipBounds = () => {
        var w = this.width
        var h = this.height
        var maxX = w
        var maxY = h
        var minX = maxX - PIP_WIDTH
        var minY = maxY - PIP_HEIGHT
        return {x: minX, y: minY, width: PIP_WIDTH, height: PIP_HEIGHT}
    }

    resize = () => {
        const w = this.width
        const h = this.height

        // ask the camera controller to update the cameras appropriately
        this.scene.resize(w, h)
        this.camera.resize(w, h)
        // update the size of the renderer and the canvas
        this.renderer.setSize(w, h)

        // scale the canvas and change its CSS width/height to make it high res.
        // note that this means the canvas will be 2x the size of the screen
        // with 2x displays - that's OK though, we know this is a FullScreen
        // CSS class and so will be made to fit in the existing window by other
        // constraints.
        this.elements.canvas.width = w * this.pixelRatio
        this.elements.canvas.height = h * this.pixelRatio

        this.elements.pipCanvas.style.left = this.pipBounds().x + 'px'

        // make sure our global transform for the general context accounts for
        // the pixelRatio
        this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0)

        this.update()
    }

    onAtomicChange = (tracker: AtomicOperationTracker) => {
        if (tracker.atomicOperationFinished()) {
            // just been turned off - trigger an update.
            this.update()
        }
    }

    // 2D Canvas helper functions
    // ========================================================================

    updateCanvasBoundingBox = (point: THREE.Vector2) => {
        // update the canvas bounding box to account for this new point
        this.ctxBox.minX = Math.min(this.ctxBox.minX, point.x)
        this.ctxBox.minY = Math.min(this.ctxBox.minY, point.y)
        this.ctxBox.maxX = Math.max(this.ctxBox.maxX, point.x)
        this.ctxBox.maxY = Math.max(this.ctxBox.maxY, point.y)
    }

    drawSelectionBox = (mouseDown: THREE.Vector2, mousePosition: THREE.Vector2) => {
        var x = mouseDown.x
        var y = mouseDown.y
        var dx = mousePosition.x - x
        var dy = mousePosition.y - y
        this.ctx.strokeRect(x, y, dx, dy)
        // update the bounding box
        this.updateCanvasBoundingBox(mouseDown);
        this.updateCanvasBoundingBox(mousePosition)
    }

    drawTargetingLines = (point: THREE.Vector2, targetLm: Landmark, secondaryLms: Landmark[]) => {

        this.updateCanvasBoundingBox(point)

        // first, draw the secondary lines
        this.ctx.save()
        this.ctx.strokeStyle = "#7ca5fe"
        this.ctx.setLineDash([5, 15])

        this.ctx.beginPath()
        secondaryLms.forEach(lm => {
            var lmPoint = this.scene.localToScreen(lm.point)
            this.updateCanvasBoundingBox(lmPoint)
            this.ctx.moveTo(lmPoint.x, lmPoint.y)
            this.ctx.lineTo(point.x, point.y)
        });
        this.ctx.stroke()
        this.ctx.restore()

        // now, draw the primary line
        this.ctx.strokeStyle = "#01e6fb"

        this.ctx.beginPath()
        const targetPoint = this.scene.localToScreen(targetLm.point)
        this.updateCanvasBoundingBox(targetPoint)
        this.ctx.moveTo(targetPoint.x, targetPoint.y)
        this.ctx.lineTo(point.x, point.y)
        this.ctx.stroke()
    };

    clearCanvas = (): void => {
        if (_.isEqual(this.ctxBox, _initialBoundingBox())) {
            // there has been no change to the canvas - no need to clear
            return null
        }
        // we only want to clear the area of the canvas that we dirtied
        // since the last clear. The _ctxBox object tracks this
        const p = 3;  // padding to be added to bounding box
        const minX = Math.max(Math.floor(this.ctxBox.minX) - p, 0)
        const minY = Math.max(Math.floor(this.ctxBox.minY) - p, 0)
        const maxX = Math.ceil(this.ctxBox.maxX) + p
        const maxY = Math.ceil(this.ctxBox.maxY) + p
        const width = maxX - minX
        const height = maxY - minY
        this.ctx.clearRect(minX, minY, width, height)
        // reset the tracking of the context bounding box tracking.
        this.ctxBox = _initialBoundingBox()
    }

}
