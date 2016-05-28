
function cssOverlayChild(s: CSSStyleDeclaration) {
        s.position = 'absolute'
        s.width = '100%'
        s.height = '100%'
}

export class DomElements {
    viewport: HTMLDivElement
    webgl: HTMLCanvasElement
    canvas: HTMLCanvasElement
    pipCanvas: HTMLCanvasElement

    constructor() {
        this.viewport = document.createElement('div')
        this.viewport.className = 'Viewport'
        this.viewport.style.position = 'relative'
        this.viewport.style.width = '100%'
        this.viewport.style.height = '100%'

        this.webgl = document.createElement('canvas')
        this.webgl.className = 'Viewport:WebGL'
        cssOverlayChild(this.webgl.style)

        this.canvas = document.createElement('canvas')
        this.canvas.className = 'Viewport:CanvasOverlay'
        cssOverlayChild(this.canvas.style)

        this.pipCanvas = document.createElement('canvas')
        this.pipCanvas.className = 'Viewport:PIPCanvasOverlay'

        this.viewport.appendChild(this.webgl)
        this.viewport.appendChild(this.canvas)
        this.viewport.appendChild(this.pipCanvas)
    }

}
