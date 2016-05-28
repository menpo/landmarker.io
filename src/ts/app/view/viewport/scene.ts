import * as THREE from 'three'

import { octreeForBufferGeometry, Octree, Intersection } from './octree'
import { Landmark } from './base'
import { LandmarkConnectionTHREEView, LandmarkTHREEView } from './elements'

type Intersectable = THREE.Object3D | THREE.Object3D[]

export interface Scene {
    mesh: THREE.Mesh
    landmarks: Landmark[]
    landmarkViews: LandmarkTHREEView[]
    connectivity: [number, number][]

    cameraMode: CAMERA_MODE
    toggleCamera: () => void,

    setMesh: (mesh: THREE.Mesh, up: THREE.Vector3, front: THREE.Vector3) => void
    removeMeshIfPresent: () => void
    setLandmarksAndConnectivity: (landmarks: Landmark[], connectivity: [number, number][]) => void
    updateLandmarks: (landmarks: Landmark[]) => void,

    sCamera: THREE.Camera
    sPCam: THREE.PerspectiveCamera
    sOCam: THREE.OrthographicCamera
    sOCamZoom: THREE.OrthographicCamera,
    scene: THREE.Scene,
    sceneHelpers: THREE.Scene,
    sLms: THREE.Object3D
    lmScale: number

    // Intersection related
    localToScreen: (v: THREE.Vector3) => THREE.Vector2
    worldToLocal: (v: THREE.Vector3) => THREE.Vector3
    getIntersects: (x: number, y: number, object: Intersectable) => Intersection[]
    getIntersectsFromEvent: (e: MouseEvent, object: Intersectable) => Intersection[]
    resize: (width: number, height: number) => void
    lmViewsInSelectionBox: (x1: number, y1: number, x2: number, y2: number) => LandmarkTHREEView[]
    lmViewVisible: (lmv: LandmarkTHREEView) => boolean
}

export enum CAMERA_MODE {
    PERSPECTIVE,
    ORTHOGRAPHIC
}

export class SceneManager implements Scene {

    width: number
    height: number

    mesh: THREE.Mesh
    landmarks: Landmark[]
    connectivity: [number, number][]

    _meshScale = 1  // The radius of the mesh's bounding sphere
    _lmScale = 1

    octree: Octree
    ray = new THREE.Raycaster()

    landmarkViews: LandmarkTHREEView[] = []
    connectivityViews: LandmarkConnectionTHREEView[] = []

    scene = new THREE.Scene()

    // we use an initial top level to handle the absolute positioning of
    // the mesh and landmarks. Rotation and scale are applied to the
    // sMeshAndLms node directly.
    sScaleRotate = new THREE.Object3D()
    sTranslate = new THREE.Object3D()

    // -------- MODEL AND LANDMARKS --------- //
    // sMeshAndLms stores the mesh and landmarks in the meshes original
    // coordinates. This is always transformed to the unit sphere for
    // consistency of camera.
    sMeshAndLms = new THREE.Object3D()
    // Lms stores the scene landmarks. This is a useful container to
    // get at all landmarks in one go, and is a child of sMeshAndLms
    sLms = new THREE.Object3D()
    // sMesh is the parent of the mesh itself in the THREE scene.
    // This will only ever have one child (the mesh).
    sMesh = new THREE.Object3D()


    // ----- HELPERS (intersection/connectivity) ----- //
    // we  build a second scene for various helpers we may need
    // (intersection planes) and for connectivity information (so it
    // shows through)
    sceneHelpers = new THREE.Scene()
    // sLmsConnectivity is used to store the connectivity representation
    // of the mesh
    sLmsConnectivity = new THREE.Object3D()
    // Bit gross, but we want to replicate the mesh scene graph in the scene helpers,
    // so we can have show-though connectivity. As such, we just have another set of
    // global nodes and keep them in sync with the scene ones.
    shScaleRotate = new THREE.Object3D()
    shTranslate = new THREE.Object3D()
    shMeshAndLms = new THREE.Object3D()

    // ----- CAMERA AND DIRECTED LIGHTS ----- //

    // we look after three cameras - one each for orthographic and
    // perspective mode, and then one for the PIP view (orthographic only for now)
    sOCam = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 20)
    sOCamZoom = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 20)
    sPCam = new THREE.PerspectiveCamera(50, 1, 0.02, 20)
    // sCamera holds the currently active camera and (optionally) any
    // lights that track with the camera as children
    sCamera: THREE.Camera

    sLights: THREE.Object3D

    constructor() {

        this.sMeshAndLms.add(this.sLms)
        this.sMeshAndLms.add(this.sMesh)

        this.sTranslate.add(this.sMeshAndLms)
        this.sScaleRotate.add(this.sTranslate)
        this.scene.add(this.sScaleRotate)

        this.shMeshAndLms.add(this.sLmsConnectivity)
        this.shTranslate.add(this.shMeshAndLms)
        this.shScaleRotate.add(this.shTranslate)
        this.sceneHelpers.add(this.shScaleRotate)

        // start with the perspective camera as the main one
        this.sCamera = this.sPCam

        // ----- SCENE: GENERAL LIGHTING ----- //
        // TODO make lighting customizable
        // TODO no spot light for images
        this.sLights = new THREE.Object3D()
        const pointLightLeft = new THREE.PointLight(0x404040, 1, 0)
        pointLightLeft.position.set(-100, 0, 100)
        this.sLights.add(pointLightLeft)
        const pointLightRight = new THREE.PointLight(0x404040, 1, 0)
        pointLightRight.position.set(100, 0, 100)
        this.sLights.add(pointLightRight)
        this.scene.add(this.sLights)
        // add a soft white ambient light
        this.sLights.add(new THREE.AmbientLight(0x404040))
    }

    get lmScale() {
        return this._lmScale
    }

    set lmScale(scale: number) {
        this._lmScale = scale
        this.scaleLandmarks()
    }

    get meshScale() {
        return this._meshScale
    }

    set meshScale(scale: number) {
        this._meshScale = scale
        this.scaleLandmarks()
    }

    scaleLandmarks() {
        const s = this.lmScale * this.meshScale
        this.sLms.children.forEach(v => v.scale.x !== s ? v.scale.set(s, s, s) : null)
    }

    get cameraMode() {
       const currentlyPerspective = (this.sCamera === this.sPCam)
       return currentlyPerspective ? CAMERA_MODE.PERSPECTIVE : CAMERA_MODE.ORTHOGRAPHIC
    }

    toggleCamera = () => {
        this.sCamera = this.cameraMode === CAMERA_MODE.PERSPECTIVE ? this.sOCam : this.sPCam
    }

    resize = (width: number, height: number) => {
        this.width = width
        this.height = height
    }

    setMesh = (mesh: THREE.Mesh, up: THREE.Vector3, front: THREE.Vector3) => {
        this.removeMeshIfPresent()
        this.mesh = mesh

        const geometry = mesh.geometry
        if (geometry instanceof THREE.BufferGeometry) {
            // octree only makes sense if we are dealing with a true mesh
            // (not images). Such meshes are always BufferGeometry instances.
            this.octree = octreeForBufferGeometry(geometry)
        }

        this.sMesh.add(mesh)
        // Rescale the sMeshAndLms to fit in the unit sphere
        // and face the right direction.

        // First, the scale...
        this.meshScale = mesh.geometry.boundingSphere.radius
        const s = 1.0 / this.meshScale
        this.sScaleRotate.scale.set(s, s, s)
        this.shScaleRotate.scale.set(s, s, s)

        // ...then the rotation...
        this.sScaleRotate.up.copy(up)
        this.shScaleRotate.up.copy(up)
        this.sScaleRotate.lookAt(front.clone())
        this.shScaleRotate.lookAt(front.clone())

        // ..and finally the translation
        const t = mesh.geometry.boundingBox.center().clone()
        t.multiplyScalar(-1.0)
        this.sTranslate.position.copy(t)
        this.shTranslate.position.copy(t)
        // finally, ensure the scale is set properly for the landmarks
        this.scaleLandmarks()
    }

    removeMeshIfPresent = () => {
        if (this.mesh !== null) {
            this.sMesh.remove(this.mesh)
            this.mesh = null
            this.octree = null
        }
    }

    setLandmarksAndConnectivity = (landmarks: Landmark[], connectivity: [number, number][]) => {
        this.landmarks = landmarks;
        this.connectivity = connectivity;
        // 1. Dispose of all landmark and connectivity views
        this.landmarkViews.forEach(lmView => lmView.dispose())
        this.connectivityViews.forEach(connView => connView.dispose())

        // 2. Build a fresh set of views
        this.landmarkViews = landmarks.map(lm =>
            new LandmarkTHREEView(lm,
                {
                    onCreate: symbol => this.sLms.add(symbol),
                    onDispose: symbol => this.sLms.remove(symbol)
                })
        );
        this.connectivityViews = connectivity.map(([a, b]) =>
            new LandmarkConnectionTHREEView(landmarks[a], landmarks[b],
                {
                    onCreate: symbol => this.sLmsConnectivity.add(symbol),
                    onDispose: symbol => this.sLmsConnectivity.remove(symbol)
                })
        )
        // finally, ensure the scale is set properly for the landmarks
        this.scaleLandmarks()
    }

    updateLandmarks = (landmarks: Landmark[]) => {
        landmarks.forEach(lm => {
            this.landmarks[lm.index] = lm
            this.landmarkViews[lm.index].render(lm)
        })

        // Finally go through all connectivity views and update them
        this.connectivityViews.forEach((view, i) => {
            const [a, b] = this.connectivity[i];
            view.render(this.landmarks[a], this.landmarks[b])
        })

    }

    // Coordinates and intersection helpers
    // =========================================================================

    getIntersects = (x: number, y: number, object: Intersectable): Intersection[] =>  {
        if (object === null || (object instanceof Array && object.length === 0)) {
            return []
        }
        const vector = new THREE.Vector3((x / this.width) * 2 - 1,
                                        -(y / this.height) * 2 + 1, 0.5)

        if (this.cameraMode == CAMERA_MODE.PERSPECTIVE) {
            // perspective selection
            vector.setZ(0.5)
            vector.unproject(this.sCamera)
            this.ray.set(this.sCamera.position, vector.sub(this.sCamera.position).normalize())
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
            return this.octree.intersectMesh(this.ray, this.mesh)
        } else if (object instanceof Array) {
            return this.ray.intersectObjects(object, true)
        } else {
            return this.ray.intersectObject(object, true);
        }
    }

    getIntersectsFromEvent = (e: MouseEvent, object: Intersectable) => this.getIntersects(e.clientX, e.clientY, object);

    worldToScreen = (v: THREE.Vector3) => {
        const halfW = this.width / 2
        const halfH = this.height / 2
        const p = v.clone().project(this.sCamera)
        return new THREE.Vector2((p.x * halfW) + halfW, -(p.y * halfH) + halfH)
    }

    worldToLocal = (v: THREE.Vector3) => this.sMeshAndLms.worldToLocal(v.clone())
    localToScreen = (v: THREE.Vector3) => this.worldToScreen(this.sMeshAndLms.localToWorld(v.clone()))

    lmViewsInSelectionBox = (x1: number, y1: number, x2: number, y2: number) =>
        this.landmarkViews.filter(lmv => {
            if (lmv.symbol) {
                const c = this.localToScreen(lmv.symbol.position)
                return c.x > x1 && c.x < x2 && c.y > y1 && c.y < y2
            } else {
                return false
            }
        })

    lmViewVisible = (lmv: LandmarkTHREEView) => {
        if (lmv.symbol === null) {
            return false
        }
        const screenCoords = this.localToScreen(lmv.symbol.position)
        // intersect the mesh and the landmarks
        const iMesh = this.getIntersects(
            screenCoords.x, screenCoords.y, this.mesh)
        const iLm = this.getIntersects(
            screenCoords.x, screenCoords.y, lmv.symbol)
        // is there no mesh here (pretty rare as landmarks have to be on mesh)
        // or is the mesh behind the landmarks?
        return iMesh.length === 0 || iMesh[0].distance > iLm[0].distance
    }

}