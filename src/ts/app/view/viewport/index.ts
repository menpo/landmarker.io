import * as THREE from 'three'
import { atomic, AtomicOperationTracker } from '../../model/atomic'

import { Landmark, LandmarkDelta } from './base'
import { DomElements } from './dom'
import { ICanvas, Canvas } from './canvas'
import { ICamera, Camera, TouchCameraHandler, MouseCameraHandler } from './camera'
import { MouseHandler, TouchHandler } from './handler'
import { IScene, Scene, CAMERA_MODE } from './scene'

// clear colour for both the main view and PictureInPicture
const CLEAR_COLOUR = 0xEEEEEE
const CLEAR_COLOUR_PIP = 0xCCCCCC

const MESH_MODE_STARTING_POSITION = new THREE.Vector3(1.0, 0.20, 1.5)
const IMAGE_MODE_STARTING_POSITION = new THREE.Vector3(0.0, 0.0, 1.0)

export interface ViewportCallbacks {
    selectLandmarks: (indicies: number[]) => void
    deselectLandmarks: (indicies: number[]) => void
    deselectAllLandmarks: () => void
    selectLandmarkAndDeselectRest: (index: number) => void
    setLandmarkPoint: (index: number, point: THREE.Vector3) => void
    setLandmarkPointWithoutHistory: (index: number, point: THREE.Vector3) => void
    addLandmarkHistory: (deltas: LandmarkDelta[]) => void
    insertNewLandmark: (point: THREE.Vector3) => void
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
    cameraIsLocked: boolean
    landmarkSnapPermitted: boolean
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

    pixelRatio = window.devicePixelRatio || 1  // 2/3 if on a HIDPI/retina display

    renderer: THREE.WebGLRenderer

    scene: IScene = new Scene()
    canvas: ICanvas
    camera: ICamera

    // null signifies no handler present.
    cameraTouchHandler: TouchCameraHandler = null
    cameraMouseHandler: MouseCameraHandler = null

    mouseHandler: MouseHandler
    touchHandler: TouchHandler

    constructor(parent: HTMLElement, meshMode: boolean, on: ViewportCallbacks) {

        // all our callbacks are stored under the on namespace.
        this.on = on
        this.meshMode = meshMode

        this.parent = parent
        this.parent.appendChild(this.elements.viewport)

        // Disable context menu on viewport related elements
        this.elements.viewport.addEventListener('contextmenu', e => e.preventDefault())

        this.canvas = new Canvas(this.elements.canvas, this.elements.pipCanvas)

        // create the camera to look after all camera state.
        this.camera = new Camera(this.width, this.height,
                                         this.scene.sPCam,
                                         this.scene.sOCam,
                                         this.scene.sOCamZoom)

        this.camera.onChange = this.updateAndClearCanvas
        // set the cameera lock status to false, which will wire up the handlers.
        this.cameraIsLocked = false

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
        this.mouseHandler = new MouseHandler(this)
        this.touchHandler = new TouchHandler(this)
        this.elements.viewport.addEventListener('mousedown', this.mouseHandler.onMouseDown)
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
        this.canvas.clear()
        this.on.deselectAllLandmarks()
        if (snapModeEnabled) {
            this.elements.viewport.addEventListener('mousemove', this.mouseHandler.onMouseMove)
        } else {
            this.elements.viewport.removeEventListener('mousemove', this.mouseHandler.onMouseMove)
        }
    }

    get cameraIsLocked() {
        // If there is no camera handler, the camera ain't moving.
        return this.cameraMouseHandler === null
    }

    set cameraIsLocked(cameraIsLocked: boolean) {
        if (this.cameraIsLocked && !cameraIsLocked) {
            // changing from locked to not - add the handlers!
            this.cameraMouseHandler = new MouseCameraHandler(this.camera, this.elements.viewport)
            this.cameraTouchHandler = new TouchCameraHandler(this.camera, this.elements.viewport)
        } else if (cameraIsLocked && !this.cameraIsLocked) {
            // Transition from not lockeed to locked! Unbind the handlers
            this.cameraMouseHandler.enabled = false
            this.cameraTouchHandler.enabled = false
            // and delete them.
            this.cameraMouseHandler = null
            this.cameraTouchHandler = null
        }
    }

    // is a snap action allowed to take place right now?
    get landmarkSnapPermitted() {
        return (this.snapModeEnabled && this.hasLandmarks &&
                !this.allLandmarksEmpty && !this.groupModeActive)
   }

    // Bring the viewport DOM into focus
    focus = () => {
        this.elements.viewport.focus()
    }

    setLandmarksAndConnectivity = (landmarks: Landmark[], connectivity: [number, number][]) => {
        console.log('Viewport:setLandmarksAndConnectivity')
        this.scene.setLandmarksAndConnectivity(landmarks, connectivity)
        this.mouseHandler.resetLandmarks()
        this.update()
    }

    updateLandmarks = (landmarks: Landmark[]) => {
        this.scene.updateLandmarks(landmarks)
        this.update()
    }

    setMesh = (mesh: THREE.Mesh, up: THREE.Vector3, front: THREE.Vector3) => {
        console.log('Viewport:setMesh - memory before: ' + this.memoryString())
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
            this.canvas.pipVisable = true
        } else {
            // leaving orthographic - stop listening to pip calls.
            this.camera.onChangePip = null
            this.canvas.pipVisable = false
        }
        // clear the canvas and re-render our state
        this.canvas.clear()
        this.update()
    }

    resetCamera = () => {
        // reposition the cameras and focus back to the starting point.
        const v = this.meshMode ? MESH_MODE_STARTING_POSITION : IMAGE_MODE_STARTING_POSITION
        this.camera.reset(v, this.scene.scene.position, this.meshMode)
        this.update()
    }

    budgeLandmarks = atomic.atomicOperation((vector: [number, number]) => {

        // Set a movement of 0.5% of the screen in the suitable direction
        const [x, y] = vector,
            move = new THREE.Vector2(),
            [dx, dy] = [.005 * window.innerWidth, .005 * window.innerHeight]

        move.set(x * dx, y * dy)

        const ops: LandmarkDelta[] = []
        this.selectedLandmarks.forEach((lm) => {
            const lmScreen = this.scene.localToScreen(lm.point)
            lmScreen.add(move)

            const intersectsWithMesh = this.scene.getIntersects(lmScreen.x, lmScreen.y,
                                                                this.scene.mesh)

            if (intersectsWithMesh.length > 0) {
                const pt = this.scene.worldToLocal(intersectsWithMesh[0].point)
                ops.push([lm.index, lm.point.clone(), pt.clone()])
                this.on.setLandmarkPointWithoutHistory(lm.index, pt)
            }
        })
        this.on.addLandmarkHistory(ops)

        this.clearCanvas()
    })

    // this is called whenever there is a state change on the THREE scene
    update = () => {
        // console.log('Viewport:update()')
        if (!this.renderer) {
            return
        }
        // if in batch mode - dont render unnecessarily
        if (atomic.atomicOperationUnderway()) {
            return
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
            this.renderer.clearDepth()
            // and render the connectivity
            this.renderer.render(scene.sceneHelpers, scene.sCamera)
        }

        // 3. Render the PIP image if in orthographic mode
        if (scene.cameraMode === CAMERA_MODE.ORTHOGRAPHIC) {
            var b = this.canvas.pipBounds(this.width, this.height)
            this.renderer.setScissor(b.x * this.pixelRatio, b.y * 2, b.width * 2, b.height * 2)
            this.renderer.setScissorTest(true)
            this.renderer.setClearColor(CLEAR_COLOUR_PIP)
            this.renderer.clear()
            this.renderer.setScissorTest(false)

            this.renderer.setViewport(b.x, b.y, b.width, b.height)

            // render the PIP image
            this.renderer.render(scene.scene, scene.sOCamZoom)
            if (this.connectivityVisable) {
                this.renderer.clearDepth() // clear depth buffer
                // and render the connectivity
                this.renderer.render(scene.sceneHelpers, scene.sOCamZoom)
            }
        }
    }

    updateAndClearCanvas = () => {
        this.update()
        this.clearCanvas()
    }

    memoryString = () => {
        return 'geo:' + this.renderer.info.memory.geometries +
               ' tex:' + this.renderer.info.memory.textures
    }

    resize = () => {
        const [w, h] = [this.width, this.height]

        // update all our constituent parts
        this.scene.resize(w, h)
        this.camera.resize(w, h)
        this.renderer.setSize(w, h)
        this.canvas.resize(w, h)
        this.update()
    }

    onAtomicChange = (tracker: AtomicOperationTracker) => {
        if (tracker.atomicOperationFinished()) {
            // just been turned off - trigger an update.
            this.update()
        }
    }

    clearCanvas = (): void => {
        this.canvas.clear()
    }

    drawTargetingLines = (point: THREE.Vector2, targetLm: Landmark, secondaryLms: Landmark[]) => {
        this.canvas.drawTargetingLines(
            point,
            this.scene.localToScreen(targetLm.point),
            secondaryLms.map(lm => this.scene.localToScreen(lm.point))
        )
    }

}
