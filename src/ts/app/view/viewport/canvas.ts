import * as THREE from 'three'
import * as _ from 'underscore'

const PIP_WIDTH = 300
const PIP_HEIGHT = 300

interface BoundingBox {
    minX: number
    minY: number
    maxX: number
    maxY: number
}

interface Bounds {
    x: number
    y: number
    width: number
    height: number
}

function initialBoundingBox() {
    return { minX: 999999, minY: 999999, maxX: 0, maxY: 0 }
}

export interface Canvas {
    pipVisable: boolean
    resize: (width: number, height: number) => void
    clear: () => void,
    drawTargetingLines: (point: THREE.Vector2, targetPoint: THREE.Vector2, secondaryPoints: THREE.Vector2[]) => void
    drawSelectionBox: (mouseDown: THREE.Vector2, mousePosition: THREE.Vector2) => void,
    pipBounds: (width: number, height: number) => Bounds
}

export class CanvasManager implements Canvas {
    canvas: HTMLCanvasElement
    pipCanvas: HTMLCanvasElement

    ctx: CanvasRenderingContext2D
    pipCtx: CanvasRenderingContext2D

    // to be efficient we want to track what parts of the canvas we are
    // drawing into each frame. This way we only need clear the relevant
    // area of the canvas which is a big perf win.
    // see this._updateCanvasBoundingBox() for usage.
    ctxBox = initialBoundingBox()
    pixelRatio = window.devicePixelRatio || 1  // 2/3 if on a HIDPI/retina display

    constructor(canvas: HTMLCanvasElement, pipCanvas: HTMLCanvasElement) {
        this.canvas = canvas
        this.pipCanvas = pipCanvas
        this.ctx = canvas.getContext('2d')
        this.pipCtx = pipCanvas.getContext('2d')

        // style the PIP canvas on initialization
        this.pipCanvas.style.position = 'fixed'
        this.pipCanvas.style.zIndex = '0'
        this.pipCanvas.style.width = PIP_WIDTH + 'px'
        this.pipCanvas.style.height = PIP_HEIGHT + 'px'
        this.pipCanvas.width = PIP_WIDTH * this.pixelRatio
        this.pipCanvas.height = PIP_HEIGHT * this.pixelRatio
        // note that the left style is left unset until the first resize
        // as we don't know the screen size at this time.

        // by default hide the PIP window.
        this.pipVisable = false

        // To compensate for retina displays we have to manually
        // scale our contexts up by the pixel ratio. To counteract this (so we
        // can work in 'normal' pixel units) add a global transform to the
        // canvas contexts we are holding on to.
        this.pipCtx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0)
        this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0)

        // Draw the PIP window - we only do this once.
        this.pipCtx.strokeStyle = '#ffffff'

        // vertical line
        this.pipCtx.beginPath()
        this.pipCtx.moveTo(PIP_WIDTH / 2, PIP_HEIGHT * 0.4)
        this.pipCtx.lineTo(PIP_WIDTH / 2, PIP_HEIGHT * 0.6)
        // horizontal line
        this.pipCtx.moveTo(PIP_WIDTH * 0.4, PIP_HEIGHT / 2)
        this.pipCtx.lineTo(PIP_WIDTH * 0.6, PIP_HEIGHT / 2)
        this.pipCtx.stroke()

        this.pipCtx.setLineDash([2, 2])
        this.pipCtx.strokeRect(0, 0, PIP_WIDTH, PIP_HEIGHT)
    }

    get pipVisable() {
        return this.pipCanvas.style.display !== 'none'
    }

    set pipVisable(isVisable) {
        this.pipCanvas.style.display = isVisable ? null : 'none'
    }

    pipBounds = (width: number, height: number) => {
        const [maxX, maxY] = [width, height]
        const [minX, minY] = [maxX - PIP_WIDTH, maxY - PIP_HEIGHT]
        return {x: minX, y: minY, width: PIP_WIDTH, height: PIP_HEIGHT}
    }

    resize = (width: number, height: number) => {
        // scale the canvas and change its CSS width/height to make it high res.
        // note that this means the canvas will be 2x the size of the screen
        // with 2x displays - that's OK though, we know this is a FullScreen
        // CSS class and so will be made to fit in the existing window by other
        // constraints.
        this.canvas.width = width * this.pixelRatio
        this.canvas.height = height * this.pixelRatio
        this.pipCanvas.style.left = this.pipBounds(width, height).x + 'px'

        // make sure our global transform for the general context accounts for
        // the pixelRatio
        this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0)
        this.pipCtx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0)
    }

    updateCanvasBoundingBox = (point: THREE.Vector2) => {
        // update the canvas bounding box to account for this new point
        this.ctxBox.minX = Math.min(this.ctxBox.minX, point.x)
        this.ctxBox.minY = Math.min(this.ctxBox.minY, point.y)
        this.ctxBox.maxX = Math.max(this.ctxBox.maxX, point.x)
        this.ctxBox.maxY = Math.max(this.ctxBox.maxY, point.y)
    }

    drawSelectionBox = (mouseDown: THREE.Vector2, mousePosition: THREE.Vector2) => {
        var x = mouseDown.x
        var y = mouseDown.y
        var dx = mousePosition.x - x
        var dy = mousePosition.y - y
        this.ctx.strokeRect(x, y, dx, dy)
        // update the bounding box
        this.updateCanvasBoundingBox(mouseDown)
        this.updateCanvasBoundingBox(mousePosition)
    }

    drawTargetingLines = (point: THREE.Vector2,
                          targetPoint: THREE.Vector2,
                          secondaryPoints: THREE.Vector2[]) => {

        this.updateCanvasBoundingBox(point)

        // first, draw the secondary lines
        this.ctx.save()
        this.ctx.strokeStyle = "#7ca5fe"
        this.ctx.setLineDash([5, 15])

        this.ctx.beginPath()
        secondaryPoints.forEach(lm => {
            this.updateCanvasBoundingBox(lm)
            this.ctx.moveTo(lm.x, lm.y)
            this.ctx.lineTo(point.x, point.y)
        })
        this.ctx.stroke()
        this.ctx.restore()

        // now, draw the primary line
        this.ctx.strokeStyle = "#01e6fb"

        this.ctx.beginPath()
        this.updateCanvasBoundingBox(targetPoint)
        this.ctx.moveTo(targetPoint.x, targetPoint.y)
        this.ctx.lineTo(point.x, point.y)
        this.ctx.stroke()
    }

    clear = () => {
        if (_.isEqual(this.ctxBox, initialBoundingBox())) {
            // there has been no change to the canvas - no need to clear
            return
        }
        // we only want to clear the area of the canvas that we dirtied
        // since the last clear. The _ctxBox object tracks this
        const p = 3  // padding to be added to bounding box
        const minX = Math.max(Math.floor(this.ctxBox.minX) - p, 0)
        const minY = Math.max(Math.floor(this.ctxBox.minY) - p, 0)
        const maxX = Math.ceil(this.ctxBox.maxX) + p
        const maxY = Math.ceil(this.ctxBox.maxY) + p
        const width = maxX - minX
        const height = maxY - minY
        this.ctx.clearRect(minX, minY, width, height)
        // reset the tracking of the context bounding box tracking.
        this.ctxBox = initialBoundingBox()
    }
}
