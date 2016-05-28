import * as THREE from 'three'

const DAMPING_FACTOR = 0.2
const PIP_ZOOM_FACTOR = 12.0

export interface ICamera {
    rotationPermitted: boolean
    width: number
    height: number
    pan: (distance: THREE.Vector3) => void
    zoom: (distance: THREE.Vector3, screenPosition: THREE.Vector2) => void
    rotate: (delta: THREE.Vector3, singleDir?:boolean) => void
    focus: (newTarget: THREE.Vector3) => void
    repositionPipView: (screenPosition: THREE.Vector2) => void
    onChange: () => void
    onChangePip: () => void
    reset: (position: THREE.Vector3, target: THREE.Vector3, canRotate: boolean) => void
    resize: (w: number, h: number) => void
}


interface Origin {
    target: THREE.Vector3,
    pCamPosition: THREE.Vector3,
    pCamUp: THREE.Vector3,
    oCamPosition: THREE.Vector3,
    oCamUp: THREE.Vector3,
    oCamZoomPosition: THREE.Vector3,
}

export class Camera implements ICamera {

    rotationPermitted = true

    _onChange: () => void = null
    _onChangePip: () => void = null

    pCam: THREE.PerspectiveCamera
    oCam: THREE.OrthographicCamera
    oCamZoom: THREE.OrthographicCamera

    origin: Origin
    target = new THREE.Vector3()
    height: number
    width: number

    // rotation tracking variables
    lastAngle: number
    lastAxis = new THREE.Vector3()

    constructor(width: number, height: number,
                pCam: THREE.PerspectiveCamera,
                oCam: THREE.OrthographicCamera,
                oCamZoom: THREE.OrthographicCamera) {
        this.width = width
        this.height = height
        this.pCam = pCam
        this.oCam = oCam
        this.oCamZoom = oCamZoom

        // save out the original position so we can reset if needed.
        this.origin = {
            target: this.target.clone(),
            pCamPosition: pCam.position.clone(),
            pCamUp: pCam.up.clone(),
            oCamPosition: oCam.position.clone(),
            oCamUp: oCam.up.clone(),
            oCamZoomPosition: oCamZoom.position.clone()
        }

    }

    get onChange() {
        return this._onChange !== null ? this._onChange : () => {}
    }

    set onChange(onChange: () => void) {
        this._onChange = onChange
    }

    get onChangePip() {
        return this._onChangePip !== null ? this._onChangePip : () => {}
    }

    set onChangePip(onChangePip: () => void) {
        this._onChangePip = onChangePip
    }

    focus = (newTarget: THREE.Vector3) => {
        // focus all cameras at a new target.
        this.target.copy(newTarget || this.origin.target)
        this.pCam.lookAt(this.target)
        this.oCam.lookAt(this.target)
        this.oCamZoom.lookAt(this.target)
    }

    reset = (position: THREE.Vector3, target: THREE.Vector3,
             rotationPermitted: boolean) => {
        console.log('camera: reset')
        this.rotationPermitted = rotationPermitted
        this.position(position)
        this.pCam.up.copy(this.origin.pCamUp)
        this.oCam.up.copy(this.origin.oCamUp)
        this.focus(target)
    }

    position = (v: THREE.Vector3) => {
        console.log('camera: position')
        // position all cameras at a new location.
        this.pCam.position.copy(v || this.origin.pCamPosition)
        this.oCam.position.copy(v || this.origin.oCamPosition)
        this.oCamZoom.position.copy(v || this.origin.oCamZoomPosition)
    }

    resize = (w: number, h: number) => {
        console.log('camera: resize')
        const aspect = w / h
        this.height = h
        this.width = w

        // 1. Update the orthographic camera
        if (aspect > 1) {
            // w > h
            this.oCam.left = -aspect
            this.oCam.right = aspect
            this.oCam.top = 1
            this.oCam.bottom = -1
        } else {
            // h > w
            this.oCam.left = -1
            this.oCam.right = 1
            this.oCam.top = 1 / aspect
            this.oCam.bottom = -1 / aspect
        }
        this.oCam.updateProjectionMatrix()

        // 2. Update the perceptive camera
        this.pCam.aspect = aspect
        this.pCam.updateProjectionMatrix()
    }

    pan = (distance: THREE.Vector3) => {
        console.log('camera: pan')
        // first, handle the pCam...
        const oDist = distance.clone()
        const normalMatrix = new THREE.Matrix3()
        normalMatrix.getNormalMatrix(this.pCam.matrix)
        distance.applyMatrix3(normalMatrix)
        distance.multiplyScalar(this.distanceToTarget() * 0.001)
        this.pCam.position.add(distance)
        // TODO should the target change as this?!
        this.target.add(distance)

        // second, the othoCam
        const o = this.screenPositionInOrthoView(new THREE.Vector2(oDist.x, oDist.y))
        // relative x movement * otho width = how much to change horiz
        const deltaH = o.xR * o.width
        this.oCam.left += deltaH
        this.oCam.right += deltaH
        // relative y movement * otho height = how much to change vert
        const deltaV = o.yR * o.height
        this.oCam.top += deltaV
        this.oCam.bottom += deltaV
        this.oCam.updateProjectionMatrix()
        this.onChange()
    }

    zoomOrthographic = (scalar: number, screenPosition: THREE.Vector2) => {
        // Then, the orthographic. In general, we are just going to squeeze in
        // the bounds of the orthographic frustum to zoom.
        const oCam = this.oCam
        if (oCam.right - oCam.left < 0.001 && scalar < 0) {
            // trying to zoom in and we are already tight. return.
            return
        }

        // Difference must respect aspect ratio, otherwise we will distort
        const a = ((oCam.top - oCam.bottom)) / (oCam.right - oCam.left)

        // find out where the mouse currently is in the view.
        const oM = this.screenPositionInOrthoView(screenPosition)

        // overall difference in height scale is scalar * 2, but we weight
        // where this comes off based on mouse position
        oCam.left -= (scalar * oM.xR) / (a)
        oCam.right += (scalar * (1 - oM.xR)) / (a)
        oCam.top += scalar * oM.yR
        oCam.bottom -= scalar * (1 - oM.yR)
        if (oCam.left > oCam.right) {
            oCam.left = oCam.right - 0.0001
        }
        if (oCam.bottom > oCam.top) {
            oCam.bottom = oCam.top - (0.0001 * a)
        }
        oCam.updateProjectionMatrix()
    }

    zoom = (distance: THREE.Vector3, screenPosition: THREE.Vector2) => {
        console.log('camera: zoom')

        // First, handling the perspective matrix
        const normalMatrix = new THREE.Matrix3()
        normalMatrix.getNormalMatrix(this.pCam.matrix)
        distance.applyMatrix3(normalMatrix)
        distance.multiplyScalar(this.distanceToTarget() * 0.001)
        this.pCam.position.add(distance)

        const orthoScalar = distance.z * 0.0007
        this.zoomOrthographic(orthoScalar, screenPosition)
        this.onChange()
    }

    distanceToTarget = (): number => {
        const v = new THREE.Vector3()
        return v.subVectors(this.target, this.pCam.position).length()
    }

    projectScreenPositionOnSphere = (px: number, py: number): THREE.Vector2 => {
        const v = new THREE.Vector2()
        v.set(
            (px - this.width / 2) / (this.width / 2),
            (this.height - 2 * py) / screen.width
        )

        return v
    }

    rotateOneCamera = (delta: THREE.Vector3, camera: THREE.Camera, singleDir=false) => {
        const quaternion = new THREE.Quaternion()
        const _delta = singleDir ? deltaForSingleDir(delta) : delta
        const angle = _delta.length()

        const targetDirection = new THREE.Vector3()
        const upDirection = new THREE.Vector3()
        const sidewaysDirection = new THREE.Vector3()
        const moveDirection = new THREE.Vector3()
        const axis = new THREE.Vector3()
        const targetToCamera = new THREE.Vector3()

        targetToCamera.copy(camera.position).sub(this.target)

        if (angle !== 0) {

            targetDirection.copy(targetToCamera).normalize()
            upDirection.copy(camera.up).normalize()
            sidewaysDirection.crossVectors(upDirection, targetDirection)
                             .normalize()

            upDirection.setLength(_delta.y)
            sidewaysDirection.setLength(_delta.x)

            moveDirection.copy(upDirection.add(sidewaysDirection))
            axis.crossVectors(moveDirection, targetToCamera).normalize()

            quaternion.setFromAxisAngle(axis, angle)
            this.lastAxis.copy(axis)
            this.lastAngle = angle
        } else if (this.lastAngle) {
            this.lastAngle *= Math.sqrt(1.0 - DAMPING_FACTOR)
            quaternion.setFromAxisAngle(this.lastAxis, this.lastAngle)
        }

        targetToCamera.applyQuaternion(quaternion)
        camera.up.applyQuaternion(quaternion)

        camera.position.copy(this.target).add(targetToCamera)
        camera.lookAt(this.target)
    }

    rotate = (delta: THREE.Vector3, singleDir=false) => {
        console.log(delta)
        if (this.rotationPermitted) {
            [this.pCam, this.oCam, this.oCamZoom].map(
                c => this.rotateOneCamera(delta, c, singleDir))
            this.onChange()
        } else {
            console.log('not allowed')
        }
    }

    screenPositionInOrthoView = (position: THREE.Vector2) => {
        // convert into relative coordinates (0-1)
        const x = position.x / this.width
        const y = position.y / this.height
        // get the current height and width of the orthographic
        const oWidth = this.oCam.right - this.oCam.left
        const oHeight = this.oCam.top - this.oCam.bottom

        // so in this coordinate ortho matrix is focused around
        const oX = this.oCam.left + x * oWidth
        const oY = this.oCam.bottom + (1 - y) * oHeight

        return {
            x: oX,
            y: oY,
            xR: x,
            yR: y,
            width: oWidth,
            height: oHeight
        }
    }

    repositionPipView = (screenPosition: THREE.Vector2) => {
        var oM = this.screenPositionInOrthoView(screenPosition)

        // and new bounds are
        var zH = oM.height / PIP_ZOOM_FACTOR
        // TODO this assumes square PIP image
        var zV = zH
        // reconstructing bounds is easy...
        const zHm = zH / 2
        const zVm = zV / 2
        this.oCamZoom.left = oM.x - (zHm)
        this.oCamZoom.right = oM.x + (zHm)
        this.oCamZoom.top = oM.y + (zVm)
        this.oCamZoom.bottom = oM.y - (zVm)
        this.oCamZoom.updateProjectionMatrix()
        // emit a special change event. If the viewport is
        // interested (i.e. we are in PIP mode) it can update
        this.onChangePip()
    }

}

// takes a 'desired' delta 3vec (from camera rotation) and clamps
// it to one direction, x or y.
const deltaForSingleDir = (delta: THREE.Vector3) : THREE.Vector3 =>
    (Math.abs(delta.x) >= Math.abs(delta.y)) ?
        new THREE.Vector3(delta.x, 0, 0) :
        new THREE.Vector3(0, delta.y, 0)
