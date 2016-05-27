import * as THREE from 'three'
import * as $ from 'jquery'
import { Landmark } from './base'
import { atomic } from '../../model/atomic'
import { Viewport } from './index'
import { touchListByType } from './lib/touch'

export default class TouchHandler {

    viewport: Viewport

    constructor(viewport: Viewport) {
        this.viewport = viewport
    }

    onTouchStart = (event: TouchEvent) => {
        event.preventDefault()
        const { finger, stylus } = touchListByType(event.touches)
        console.log(`touchStart: ${finger.length} fingers, ${stylus.length} stylus (id ${stylus[0].identifier})`)
    }

    onTouchMove = (event: TouchEvent) => {
        event.preventDefault()
        const { finger, stylus } = touchListByType(event.touches)
        console.log(`touchMove: ${finger.length} fingers, ${stylus.length} stylus (id ${stylus[0].identifier})`)
    }
}
