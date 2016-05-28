import * as THREE from 'three'
import { ICamera } from './base'
import { touchToVector3, pinchGapAndCenter, touchListByType} from '../lib/touch'

const PINCH_GEUSTURE_DEBOUNCE_MS = 200

export class TouchCameraHandler {
    camera: ICamera
    domElement: HTMLElement
    _enabled = false

    prevTouchVector = new THREE.Vector3()
    prevPinchGap: number = null
    timestampOfLastPinch: number = 0

    constructor(camera: ICamera, domElement: HTMLElement) {
        this.camera = camera
        this.domElement = domElement
        // set the enabled flag and trigger the event listeners.
        this.enabled = true
    }

    get enabled() {
        return this._enabled
    }

    set enabled(enabled: boolean) {
        if (enabled && !this.enabled) {
            // changing from off to on:
            this.domElement.addEventListener('touchstart', this.touchStart)
            this.domElement.addEventListener('touchmove', this.touchMove)
        } else if (!enabled) {
            // should be off.
            this._enabled = false
            this.domElement.removeEventListener('touchstart', this.touchStart)
            this.domElement.removeEventListener('touchmove', this.touchMove)
        }
    }

    touchStart = (event: TouchEvent) => {
        console.log('TouchCameraController:touchStart')
        event.preventDefault()
        const touchesByType = touchListByType(event.touches)
        const touches = touchesByType.finger // only listen to finger guestures.

        // On a new touch start we just want to start recording previous states
        // so they are set for the touchMove event.
        if (touches.length === 1 || touches.length === 3) {
            this.prevTouchVector = touchToVector3(touches[0])
        }

        if (touches.length === 2) {
            const { pinchGap } = pinchGapAndCenter(touches[0], touches[1])
            this.prevPinchGap = pinchGap
        }
    }

    touchMove = (event: TouchEvent) => {
        console.log('TouchCameraController:touchMove')
        event.preventDefault()
        const touchesByType = touchListByType(event.touches)
        const touches = touchesByType.finger // only listen to finger guestures.

        switch (touches.length) {
            case 1:
                // check we aren't suspiciously soon after a pinch guesture for a single
                // touch - which would just be a human not releasing both digits perfectly
                // simultaneously!
                if (event.timeStamp - this.timestampOfLastPinch > PINCH_GEUSTURE_DEBOUNCE_MS) {
                     this.singleFingerPan(touches[0])
                } else {
                    console.log('Not rotating')
                }
                break
            case 2:
                this.pinchToZoom(touches[0], touches[1])
                break
            case 3:
                this.threeFingerPan(touches[0])
                break
        }
    }

    singleFingerPan = (touch: Touch) => {
        const touchVector = touchToVector3(touch)
        const delta = new THREE.Vector3
        delta.subVectors(touchVector, this.prevTouchVector).multiplyScalar(0.005)
        delta.setY(-1 * delta.y)
        this.camera.rotate(delta)
        this.prevTouchVector = touchVector
    }

    pinchToZoom = (touchA: Touch, touchB: Touch) => {
        const { pinchGap, pinchCenter } = pinchGapAndCenter(touchA, touchB)

        // Zoom along the camera axis (Z) proportional to the change in pinch gap.
        const zoomVector = new THREE.Vector3(0, 0, this.prevPinchGap - pinchGap)
        this.camera.zoom(zoomVector, pinchCenter)

        this.prevPinchGap = pinchGap
        this.timestampOfLastPinch = event.timeStamp
    }

    // Although this is triggered whenever three fingers are on the display,
    // only works of the first finger for now.
    threeFingerPan(touch: Touch) {
        const touchVector = touchToVector3(touch)
        const delta = new THREE.Vector3
        delta.subVectors(touchVector, this.prevTouchVector)
        delta.setX(-delta.x)
        this.camera.pan(delta)
        this.prevTouchVector = touchVector
    }
}
