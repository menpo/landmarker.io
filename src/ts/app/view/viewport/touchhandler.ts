import * as THREE from 'three'
import * as $ from 'jquery'
import { Landmark } from './base'
import { atomic } from '../../model/atomic'
import { Viewport } from './index'


export default class TouchHandler {

    viewport: Viewport

    constructor(viewport: Viewport) {
        this.viewport = viewport
    }

    onTouchStart = (event: TouchEvent) => {
        event.preventDefault()
        console.log('a touch for our touch handler!')
    }

    onTouchMove = (event: TouchEvent) => {
        event.preventDefault()
        console.log('a touch move for our touch handler!')
    }
}
