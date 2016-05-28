import * as THREE from 'three'
import { ICamera } from './base'
import { listenOnce } from '../lib/event'

const MOUSE_WHEEL_SENSITIVITY = 0.5
const ROTATION_SENSITIVITY = 3.5
const DAMPING_FACTOR = 0.2

enum STATE {
    NONE,
    ROTATE,
    ZOOM,
    PAN
}

// see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent.deltaMode
const UNITS_FOR_MOUSE_WHEEL_DELTA_MODE = [
    1.0, // 0: The delta values are specified in pixels.
    34.0, // 1: The delta values are specified in lines.
    1.0 // 2: The delta values are specified in pages.
]

export class MouseCameraHandler {
    camera: ICamera
    domElement: HTMLElement
    state = STATE.NONE

    // mouse tracking variables
    mousePrevPosition = new THREE.Vector2()
    mousePosition = new THREE.Vector2()

    constructor(camera: ICamera,
                domElement: HTMLElement) {
        this.camera = camera
        this.domElement = domElement
        this.domElement.addEventListener('mousemove', this.onMouseHover, false)
        this.domElement.addEventListener('mousedown', this.onMouseDown, false)
        this.domElement.addEventListener('wheel', this.onMouseWheel, false)
    }

    onMouseHover = (event: MouseEvent) => {
        this.mousePosition.set(event.pageX, event.pageY)
        this.camera.repositionPipView(this.mousePosition)
    }

    onMouseDown = (event: MouseEvent) => {
        console.log('camera: mousedown')
        event.preventDefault()

        switch (event.button) {
            case 0:
                this.state = this.camera.rotationPermitted ? STATE.ROTATE : STATE.PAN
                break
            case 1:
                this.state = STATE.ZOOM
                break
            case 2:
                this.state = STATE.PAN
                break
        }

        if (this.state === STATE.ROTATE) {
            this.mousePrevPosition.copy(this.projectMouseOnSphere(event.pageX,
                                                        event.pageY))
        } else {
            this.mousePrevPosition.set(event.pageX, event.pageY)
        }

        document.addEventListener('mousemove', this.onMouseMove)
        listenOnce(document, 'mouseup', this.onMouseUp)
    }

    onMouseMove = (event: MouseEvent) => {
        console.log('camera: mousemove')
        event.preventDefault()
        const v = new THREE.Vector3
        const mousePosition = new THREE.Vector2()
        const mouseMoveDelta = new THREE.Vector2()

        if (this.state === STATE.ROTATE) {
            mousePosition.copy(
                this.projectMouseOnSphere(event.pageX, event.pageY))
        } else {
            mousePosition.set(event.pageX, event.pageY)
        }
        mouseMoveDelta.subVectors(mousePosition, this.mousePrevPosition)

        switch (this.state) {
            case STATE.ROTATE:
                v.set(mouseMoveDelta.x, mouseMoveDelta.y, 0)
                v.multiplyScalar(ROTATION_SENSITIVITY)
                this.camera.rotate(v, event.ctrlKey)
                break
            case STATE.ZOOM:
                v.set(0, 0, mouseMoveDelta.y)
                this.camera.zoom(v, this.mousePosition)
                break
            case STATE.PAN:
                v.set(-mouseMoveDelta.x, mouseMoveDelta.y, 0)
                this.camera.pan(v)
                break
        }

        this.mousePrevPosition.copy(mousePosition)
    }

    onMouseUp = (event: MouseEvent) => {
        event.preventDefault()
        document.removeEventListener('mousemove', this.onMouseMove)
        this.state = STATE.NONE
    }

    onMouseWheel = (event: WheelEvent) => {
        // we need to check the deltaMode to determine the scale of the mouse
        // wheel reading.
        const scale = UNITS_FOR_MOUSE_WHEEL_DELTA_MODE[event.deltaMode]
        const v = new THREE.Vector3(0, 0, -event.deltaY * MOUSE_WHEEL_SENSITIVITY * scale)
        this.camera.zoom(v, this.mousePosition)
    }

    projectMouseOnSphere = (px: number, py: number): THREE.Vector2 => {
        const v = new THREE.Vector2()
        // TODO this seems strangely non-symmetric?
        v.set(
            (px - this.camera.width / 2) / (this.camera.width / 2),
            (this.camera.height - 2 * py) / this.camera.width
        )
        return v
    }

}
