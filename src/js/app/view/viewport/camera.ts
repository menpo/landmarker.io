import * as THREE from 'three';
import * as $ from 'jquery';

const MOUSE_WHEEL_SENSITIVITY = 0.5;
const ROTATION_SENSITIVITY = 3.5;
const DAMPING_FACTOR = 0.2;
const PIP_ZOOM_FACTOR = 12.0;
// const EPS = 0.000001;

const STATE = {
    NONE: -1,
    ROTATE: 0,
    ZOOM: 1,
    PAN: 2
};

// see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent.deltaMode
const UNITS_FOR_MOUSE_WHEEL_DELTA_MODE = {
    0: 1.0, // The delta values are specified in pixels.
    1: 34.0, // The delta values are specified in lines.
    2: 1.0 // The delta values are specified in pages.
};

interface Origin {
    target: THREE.Vector3,
    pCamPosition: THREE.Vector3,
    pCamUp: THREE.Vector3,
    oCamPosition: THREE.Vector3,
    oCamUp: THREE.Vector3,
    oCamZoomPosition: THREE.Vector3,
}

/**
 * Controller for handling basic camera events on a Landmarker.
 *
 * A landmarker in general has complex state - what landmarks are selected,
 * what mesh is being used, lighting arrangements, and so on. The camera's
 * behavior however is simple - in response to certain mouse and touch
 * interactions, the camera is rotated, zoomed, and panned around some sort of
 * target. This class encapsulates this behavior.
 *
 * Takes a camera object as it's first parameter, and optionally a domElement to
 * attach to (if none provided, the document is used).
 *
 * Hooks up the following callbacks to the domElement:
 *
 * - focus(target)  // refocus the camera on a new target
 * - pan(vector)  // pan the camera along a certain vector
 * - zoom(vector)  // zoom the camera along a certain vector
 * - rotate(delta)  // rotate the camera around the target
 *
 * Note that other more complex behaviors (selecting and repositioning landmarks
 * for instance) can disable the Controller temporarily with the enabled
 * property.
 */
export class CameraController {
    
    onChange: () => any = null
    onChangePip: () => any = null
    
    pCam: THREE.PerspectiveCamera
    oCam: THREE.OrthographicCamera 
    oCamZoom: THREE.OrthographicCamera 
    domElement: HTMLElement
    state = STATE.NONE
    enabled = false
    canRotate = true // note that we will enable on creation below!
    target = new THREE.Vector3()
    origin: Origin
    height = 0
    width = 0
    
    normalMatrix = new THREE.Matrix3()
    
    // Rotation specific values
    lastAngle: number
    lastAxis = new THREE.Vector3()
    
    // mouse tracking variables
    mousePrevPosition = new THREE.Vector2()
    // Mouses position hovering over the surface
    mouseHoverPosition = new THREE.Vector2()
       
    // touch
    touch = new THREE.Vector3();
    prevTouch = new THREE.Vector3();
    prevDistance = null;
        
    constructor(pCam: THREE.PerspectiveCamera, 
                oCam: THREE.OrthographicCamera, 
                oCamZoom: THREE.OrthographicCamera, 
                domElement: HTMLElement) {
        this.pCam = pCam
        this.oCam = oCam
        this.oCamZoom = oCamZoom
        this.domElement = domElement

        this.origin = {
            target: this.target.clone(),
            pCamPosition: pCam.position.clone(),
            pCamUp: pCam.up.clone(),
            oCamPosition: oCam.position.clone(),
            oCamUp: oCam.up.clone(),
            oCamZoomPosition: oCamZoom.position.clone()
        }
        
        //TODO should this always be enabled?
        domElement.addEventListener('touchstart', this.touchStart, false)
        domElement.addEventListener('touchmove', this.touchMove, false)

        // enable everything on creation
        this.enable()
        $(domElement).on('mousemove.pip', this.onMouseMoveHover)
    }

    focus = (newTarget: THREE.Vector3) => {
        // focus all cameras at a new target.
        this.target.copy(newTarget || this.origin.target)
        this.pCam.lookAt(this.target)
        this.oCam.lookAt(this.target)
        this.oCamZoom.lookAt(this.target)
    }

    reset = (newPosition: THREE.Vector3, newTarget: THREE.Vector3, 
             newCanRotate: boolean) => {
        this.state = STATE.NONE
        this.allowRotation(newCanRotate)
        this.position(newPosition)
        this.pCam.up.copy(this.origin.pCamUp)
        this.oCam.up.copy(this.origin.oCamUp)
        this.focus(newTarget)
    }

    position = (v: THREE.Vector3) => {
        // position all cameras at a new location.
        this.pCam.position.copy(v || this.origin.pCamPosition);
        this.oCam.position.copy(v || this.origin.oCamPosition);
        this.oCamZoom.position.copy(v || this.origin.oCamZoomPosition);
    }

    allowRotation = (allowed=true) => {
        this.canRotate = allowed
    }

    disable = () => {
        console.log('camera: disable');
        this.enabled = false;
        $(this.domElement).off('mousedown.camera');
        $(this.domElement).off('wheel.camera');
        $(document).off('mousemove.camera');
    }

    enable = () => {
        if (!this.enabled) {
            console.log('camera: enable');
            this.enabled = true;
            $(this.domElement).on('mousedown.camera', this.onMouseDown);
            $(this.domElement).on('wheel.camera', this.onMouseWheel);
        }
    }

    resize (w: number, h: number) {
        const aspect = w / h;
        this.height = h;
        this.width = w;

        // 1. Update the orthographic camera
        if (aspect > 1) {
            // w > h
            this.oCam.left = -aspect;
            this.oCam.right = aspect;
            this.oCam.top = 1;
            this.oCam.bottom = -1;
        } else {
            // h > w
            this.oCam.left = -1;
            this.oCam.right = 1;
            this.oCam.top = 1 / aspect;
            this.oCam.bottom = -1 / aspect;
        }
        this.oCam.updateProjectionMatrix();

        // 2. Update the perceptive camera
        this.pCam.aspect = aspect;
        this.pCam.updateProjectionMatrix();
    }
    
    pan = (distance) => {
        // first, handle the pCam...
        const oDist = distance.clone();
        this.normalMatrix.getNormalMatrix(this.pCam.matrix);
        distance.applyMatrix3(this.normalMatrix);
        distance.multiplyScalar(this.distanceToTarget() * 0.001);
        this.pCam.position.add(distance);
        // TODO should the target change as this?!
        this.target.add(distance);

        // second, the othoCam
        const o = this.mousePositionInOrthographicView(oDist);
        // relative x movement * otho width = how much to change horiz
        const deltaH = o.xR * o.width;
        this.oCam.left += deltaH;
        this.oCam.right += deltaH;
        // relative y movement * otho height = how much to change vert
        const deltaV = o.yR * o.height;
        this.oCam.top += deltaV;
        this.oCam.bottom += deltaV;
        this.oCam.updateProjectionMatrix();
        this._change();
    }

    zoom = (distance: THREE.Vector3) => {
        const scalar = distance.z * 0.0007
        // First, handling the perspective matrix
        this.normalMatrix.getNormalMatrix(this.pCam.matrix)
        distance.applyMatrix3(this.normalMatrix)
        distance.multiplyScalar(this.distanceToTarget() * 0.001)
        this.pCam.position.add(distance)


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
        const oM = this.mousePositionInOrthographicView(this.mouseHoverPosition)

        // overall difference in height scale is scalar * 2, but we weight
        // where this comes off based on mouse position
        oCam.left -= (scalar * oM.xR) / (a);
        oCam.right += (scalar * (1 - oM.xR)) / (a);
        oCam.top += scalar * oM.yR;
        oCam.bottom -= scalar * (1 - oM.yR);
        if (oCam.left > oCam.right) {
            oCam.left = oCam.right - 0.0001;
        }
        if (oCam.bottom > oCam.top) {
            oCam.bottom = oCam.top - (0.0001 * a);
        }
        oCam.updateProjectionMatrix();
        // call the mouse hover callback manually, he will trigger a change
        // for us. Little nasty, but we mock the event...
        this.onMouseMoveHover({
            pageX: this.mouseHoverPosition.x,
            pageY: this.mouseHoverPosition.y
        });
        this._change();
    }

    distanceToTarget = (): number => {
        const v = new THREE.Vector3()
        return v.subVectors(this.target, this.pCam.position).length()
    }
    
    projectMouseOnSphere = (px: number, py: number): THREE.Vector2 => {
        const v = new THREE.Vector2()
        v.set(
            (px - this.width / 2) / (this.width / 2),
            (this.height - 2 * py) / screen.width
        )

        return v
    }

    _rotateOneCamera = (delta: THREE.Vector3, camera: THREE.Camera, singleDir=false) => {
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
        this._rotateOneCamera(delta, this.pCam, singleDir)
        this._rotateOneCamera(delta, this.oCam, singleDir)
        this._rotateOneCamera(delta, this.oCamZoom, singleDir)
        this._change()
    }

    onMouseDown = (event) => {
        console.log('camera: mousedown');
        if (!this.enabled) {
            return;
        }

        event.preventDefault();

        switch (event.button) {
            case 0:
                if (!this.canRotate) {
                    this.state = STATE.PAN;
                } else {
                    this.state = STATE.ROTATE;
                }
                break;
            case 1:
                this.state = STATE.ZOOM;
                break;
            case 2:
                this.state = STATE.PAN;
                break;
        }

        if (this.state === STATE.ROTATE) {
            this.mousePrevPosition.copy(this.projectMouseOnSphere(event.pageX,
                                                        event.pageY));
        } else {
            this.mousePrevPosition.set(event.pageX, event.pageY);
        }

        $(document).on('mousemove.camera', this.onMouseMove);
        // listen once for the mouse up
        $(document).one('mouseup.camera', this.onMouseUp);
    }

    onMouseMove = (event) => {
        event.preventDefault()   
        const v = new THREE.Vector3
        const mousePosition = new THREE.Vector2()
        const mouseMoveDelta = new THREE.Vector2()

        if (this.state === STATE.ROTATE) {
            mousePosition.copy(
                this.projectMouseOnSphere(event.pageX, event.pageY));
        } else {
            mousePosition.set(event.pageX, event.pageY);
        }
        mouseMoveDelta.subVectors(mousePosition, this.mousePrevPosition);

        switch (this.state) {
            case STATE.ROTATE:
                v.set(mouseMoveDelta.x, mouseMoveDelta.y, 0)
                v.multiplyScalar(ROTATION_SENSITIVITY);
                this.rotate(v, event.ctrlKey);
                break;
            case STATE.ZOOM:
                v.set(0, 0, mouseMoveDelta.y);
                this.zoom(v);
                break;
            case STATE.PAN:
                v.set(-mouseMoveDelta.x, mouseMoveDelta.y, 0);
                this.pan(v);
                break;
        }

        this.mousePrevPosition.copy(mousePosition);
    }

    mousePositionInOrthographicView = (v) => {
        // convert into relative coordinates (0-1)
        const x = v.x / this.domElement.offsetWidth
        const y = v.y / this.domElement.offsetHeight
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

    onMouseMoveHover = (event) => {
        this.mouseHoverPosition.set(event.pageX, event.pageY);
        var oM = this.mousePositionInOrthographicView(this.mouseHoverPosition);

        // and new bounds are
        var zH = oM.height / PIP_ZOOM_FACTOR;
        // TODO this assumes square PIP image
        var zV = zH;
        // reconstructing bounds is easy...
        const zHm = zH / 2,
            zVm = zV / 2;
        this.oCamZoom.left = oM.x - (zHm);
        this.oCamZoom.right = oM.x + (zHm);
        this.oCamZoom.top = oM.y + (zVm);
        this.oCamZoom.bottom = oM.y - (zVm);
        this.oCamZoom.updateProjectionMatrix();
        // emit a special change event. If the viewport is
        // interested (i.e. we are in PIP mode) it can update
        this._changePip();
    }

    _changePip = () => {
        if (this.onChangePip !== null) {
            this.onChangePip();
        }
    }

    _change = () => {
        if (this.onChange !== null) {
            this.onChange();
        }
    }

    onMouseUp = (event) => {
        console.log('camera: up');
        event.preventDefault();
        $(document).off('mousemove.camera');
        this.state = STATE.NONE;
    }

    onMouseWheel = (event) => {
        //console.log('camera: mousewheel');
        if (!this.enabled) {
            return;
        }
        // we need to check the deltaMode to determine the scale of the mouse
        // wheel reading.
        var scale = UNITS_FOR_MOUSE_WHEEL_DELTA_MODE[event.originalEvent.deltaMode]
        const v = new THREE.Vector3(0, 0, -event.originalEvent.deltaY * MOUSE_WHEEL_SENSITIVITY * scale)
        this.zoom(v)
    }

    touchStart = (event) => {
        if (!this.enabled) {
            return;
        }
        const touches = event.touches;
        switch (touches.length) {
            case 2:
                var dx = touches[0].pageX - touches[1].pageX;
                var dy = touches[0].pageY - touches[1].pageY;
                this.prevDistance = Math.sqrt(dx * dx + dy * dy);
                break;
        }
        this.prevTouch.set(touches[0].pageX, touches[0].pageY, 0);
    }

    touchMove = (event) => {
        if (!this.enabled) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        var touches = event.touches;
        this.touch.set(touches[0].pageX, touches[0].pageY, 0);
        switch (touches.length) {
            case 1:
                const delta = this.touch.sub(this.prevTouch).multiplyScalar(0.005);
                delta.setY(-1 * delta.y);
                this.rotate(delta);
                break;
            case 2:
                var dx = touches[0].pageX - touches[1].pageX;
                var dy = touches[0].pageY - touches[1].pageY;
                var distance = Math.sqrt(dx * dx + dy * dy);
                this.zoom(new THREE.Vector3(0, 0, this.prevDistance - distance));
                this.prevDistance = distance;
                break;
            case 3:
                this.pan(this.touch.sub(this.prevTouch).setX(-this.touch.x));
                break;
        }
        this.prevTouch.set(touches[0].pageX, touches[0].pageY, 0);
    }
}


// takes a 'desired' delta 3vec (from camera rotation) and clamps
// it to one direction, x or y.
const deltaForSingleDir = (delta: THREE.Vector3) : THREE.Vector3 =>
    (Math.abs(delta.x) >= Math.abs(delta.y)) ? 
        new THREE.Vector3(delta.x, 0, 0) : 
        new THREE.Vector3(0, delta.y, 0)
 