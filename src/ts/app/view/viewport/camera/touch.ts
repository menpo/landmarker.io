import * as THREE from 'three'
import { Camera } from './camera'

const PINCH_GEUSTURE_DEBOUNCE_MS = 200

export class TouchCameraController {
    camera: Camera
    domElement: HTMLElement

    // touch tracking variables
    prevTouchVector = new THREE.Vector3()
    prevPinchGap: number = null
    timeOfLastPinchTouch: number = 0

    constructor(camera: Camera, domElement: HTMLElement) {
        this.camera = camera
        this.domElement = domElement
        domElement.addEventListener('touchstart', this.touchStart, false)
        domElement.addEventListener('touchmove', this.touchMove, false)
    }

    touchStart = (event: TouchEvent) => {
        console.log('TouchCameraController:touchStart')
        event.preventDefault()

        const touches = event.touches
        switch (touches.length) {
            case 2:
                var dx = touches[0].pageX - touches[1].pageX
                var dy = touches[0].pageY - touches[1].pageY
                this.prevPinchGap = Math.sqrt(dx * dx + dy * dy)
                break
        }
        this.prevTouchVector = touchToVector3(touches[0])
    }

    touchMove = (event: TouchEvent) => {
        console.log('TouchCameraController:touchMove')
        event.preventDefault()

        const touches = event.touches

        switch (touches.length) {
            case 1:
                // check we aren't suspiciously soon after a pinch guesture for a single
                // touch - which would just be a human not releasing both digits perfectly
                // simultaneously!
                if (event.timeStamp - this.timeOfLastPinchTouch > PINCH_GEUSTURE_DEBOUNCE_MS) {
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
        if (touches.length > 0) {
            this.prevTouchVector = touchToVector3(touches[0])
        }
    }

    singleFingerPan = (touch: Touch) => {
        const touchVector = touchToVector3(touch)
        const delta = new THREE.Vector3
        delta.subVectors(touchVector, this.prevTouchVector).multiplyScalar(0.005)
        delta.setY(-1 * delta.y)
        this.camera.rotate(delta)
    }

    pinchToZoom = (touchA: Touch, touchB: Touch) => {
         // Two touches. Compute the distance
        const v1 = touchToVector2(touchA)
        const v2 = touchToVector2(touchB)

        const difference = new THREE.Vector2()
        const center = new THREE.Vector2()
        difference.subVectors(v1, v2)
        center.addVectors(v1, v2).divideScalar(2)
        const pinchGap = difference.length()

        // Zoom along the camera axis (Z) proportional to the change in pinch gap.
        const zoomVector = new THREE.Vector3(0, 0, this.prevPinchGap - pinchGap)
        this.camera.zoom(zoomVector, center)

        this.prevPinchGap = pinchGap
        this.timeOfLastPinchTouch = event.timeStamp
    }

    // Although this is triggered whenever three fingers are on the display,
    // only works of the first finger for now.
    threeFingerPan(touch: Touch) {
        const touchVector = touchToVector3(touch)
        const delta = new THREE.Vector3
        delta.subVectors(touchVector, this.prevTouchVector)
        delta.setX(-delta.x)
        this.camera.pan(delta)
    }
}

const touchToVector2 = (t: Touch): THREE.Vector2 => new THREE.Vector2(t.pageX, t.pageY)
const touchToVector3 = (t: Touch): THREE.Vector3 => new THREE.Vector3(t.pageX, t.pageY, 0)
