import * as THREE from 'three'
import * as $ from 'jquery'
import { Landmark } from '../base'
import { atomic } from '../../../model/atomic'
import { Viewport } from '../index'
import { touchListByType } from '../lib/touch'
import { findClosestLandmarks } from './base'

export class TouchHandler {

    viewport: Viewport

    constructor(viewport: Viewport) {
        this.viewport = viewport
    }

    onTouchStart = (event: TouchEvent) => {
        event.preventDefault()
        const { finger, stylus } = touchListByType(event.touches)
        if (stylus.length === 1) {
            console.log(`touchStart: ${finger.length} fingers, ${stylus.length} stylus (id ${stylus[0].identifier})`)
            this.stylusSnapLandmark(stylus[0])
        }
    }

    onTouchMove = (event: TouchEvent) => {
        event.preventDefault()
        const { finger, stylus } = touchListByType(event.touches)
        if (stylus.length === 1) {
            console.log(`touchMove: ${finger.length} fingers, ${stylus.length} stylus (id ${stylus[0].identifier})`)
            this.stylusSnapLandmark(stylus[0])
        }
    }

    // Move handlers
    // ------------------------------------------------------------------------
    stylusSnapLandmark = atomic.atomicOperation((touch: Touch) => {

        if (!this.viewport.landmarkSnapPermitted) {
            return
        }
        // only here as:
        // 1. Snap mode is enabled
        // 2. No group selection is made
        // 3. There is at least one landmark

        const intersectsWithMesh = this.viewport.scene.getIntersectsFromEvent(touch, this.viewport.scene.mesh)

        if (intersectsWithMesh.length == 0) {
            // touch off of the mesh does nothing.
            return
        }
        const touchLoc = this.viewport.scene.worldToLocal(intersectsWithMesh[0].point)
        const [newTarget] = findClosestLandmarks(this.viewport.nonEmptyLandmarks, touchLoc, 1)
        // this.viewport.clearCanvas()
        // this.viewport.drawTargetingLines(new THREE.Vector2(touch.clientX, touch.clientY), newTarget, [])
        this.viewport.on.selectLandmarkAndDeselectRest(newTarget.index)
        this.viewport.on.setLandmarkPoint(newTarget.index, touchLoc)
    })
}
