import * as $ from 'jquery'

import Modal from './modal'
import { App } from '../model/app'
import { IViewport } from '../view/viewport'
import { LandmarkGroup } from '../model/landmark'
// Up and down are inverted due to the way THREE handles coordinates
const ARROW_CODES_TO_VECTORS: {[index:number]: [number, number]} = {
    37: [-1, 0],  // Left
    38: [0, -1],  // Up
    39: [1, 0],   // Right
    40: [0, 1]    // Down
}

type KeyHandler = (lms: LandmarkGroup, app?: App, viewport?: IViewport) => void
type Shortcut = [KeyHandler, boolean, boolean]

const SHORTCUTS: { [index:string]: Shortcut} = {
    // Structure is [fn, acceptShift?, needLms?]
    // Shortcuts activated without SHIFT, but CAPS LOCK ok (letters)
    "d": [function (lms) { // d = [d]elete selected
        lms.deleteSelected()
    }, false, true],

    "q": [function (lms) { // q = deselect all
        lms.deselectAll()
    }, false, true],

    "r": [function (lms, app, viewport) { // r = [r]eset camera
        // TODO fix for multiple cameras (should be in camera controller)
        viewport.resetCamera()
    }, false, false],

    "t": [function (lms, app) { // t = toggle [t]exture (mesh mode only)
        if (app.meshMode()) {
            app.asset.textureToggle()
        }
    }, false, false],

    "a": [function (lms, app) { // a = select [a]ll
        app.landmarks.selectAll()
    }, false, true],

    "g": [function (lms) { // g = complete [g]roup selection
        lms.completeGroups()
    }, false, true],

    "c": [function (lms, app, viewport) { // c = toggle [c]amera mode
        if (app.meshMode()) {
            viewport.toggleCamera()
        }
    }, false, false],

    "j": [function (lms, app) { // j = down, next asset
        app.nextAsset()
    }, false, false],

    "k": [function (lms, app) { // k = up, previous asset
        app.previousAsset()
    }, false, false],

    "l": [function (lms, app) { // l = toggle [l]inks
        app.toggleConnectivity()
    }, false, false],

    "e": [function (lms, app) { // e = toggle [e]dit mode
        app.toggleEditing()
    }, false, false],

    "z": [function (lms) { // z = undo
        if (lms && lms.tracker.canUndo) {
            lms.undo()
        }
    }, false, true],

    "y": [function (lms) { // y = redo
        if (lms && lms.tracker.canRedo) {
            lms.redo()
        }
    }, false, true],

    // Keys where shift key may be needed on certain keyboard layouts
    "?": [function (lms, app) {
        app.toggleHelpOverlay()
    }, true, false],

    "+": [function (lms, app) {
        app.incrementLandmarkSize()
    }, true, false],

    "-": [function (lms, app) {
        app.decrementLandmarkSize()
    }, true, false]
}

export class KeyboardShortcutsHandler {

    app: App
    viewport: IViewport

    constructor(app: App, viewport: IViewport) {
        this.app = app
        this.viewport = viewport
    }

    keypress = (event: KeyboardEvent) => {

        // Don't fire on input fields
        if ($(event.target).closest("input[type='text']")[0]) {
            return
        }

        const key = String.fromCharCode(event.which).toLowerCase()

        // We don't respond to this key.
        if (!SHORTCUTS.hasOwnProperty(key)) {
            return
        }

        if (this.app.isHelpOverlayOn && key !== "?" || Modal.active()) {
            return
        }

        const lms = this.app.landmarks
        const [fn, acceptShift, needLms] = SHORTCUTS[key]
        if (
            fn &&
            (event.shiftKey && acceptShift || !event.shiftKey) &&
            (lms && needLms || !needLms)
        ) {
            fn(lms, this.app, this.viewport)
        }
    }

    keydown = (event: KeyboardEvent) => {

        if (event.which === 27) {
            if (this.app.isHelpOverlayOn) {
                this.app.toggleHelpOverlay()
                event.stopPropagation()
                return
            }

            const modal = Modal.active()
            if (modal) {
                if (modal.closable) {
                    modal.close()
                }
                event.stopPropagation()
                return
            }

            if ($('#templatePicker').hasClass('Active')) {
                $('#templatePicker').removeClass('Active')
                return
            }

            if (this.app.landmarks) {
                this.app.landmarks.deselectAll()
                event.stopPropagation()
                return
            }
        } else if (event.which === 83 && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            if (this.app.landmarks) {
                this.app.landmarks.save()
            }
        } else if (event.which >= 37 && event.which <= 40) { // arrow keys
            this.app.budgeLandmarks(ARROW_CODES_TO_VECTORS[event.which])
        }
    }

    enable = () => {
        window.addEventListener('keypress', this.keypress)
        window.addEventListener('keydown', this.keydown)
    }

    disable = () => {
        window.removeEventListener('keypress', this.keypress)
        window.removeEventListener('keydown', this.keydown)
    }

}
