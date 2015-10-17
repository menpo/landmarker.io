'use strict';

import $ from 'jquery';

import Modal from './modal';

export default function KeyboardShortcutsHandler (app, viewport) {
    this._keypress = function (e) {

        // Don't fire on input fields
        if ($(e.target).closest("input[type='text']")[0]) {
            return null;
        }

        const key = String.fromCharCode(e.which).toLowerCase();

        if (app.isHelpOverlayOn() && key !== "?" || Modal.active()) {
            return null;
        }

        const lms = app.landmarks();

        switch (key) {
            case "d":  // d = [d]elete selected
                if (lms) {
                    lms.deleteSelected();
                    $('#viewportContainer').trigger("groupDeselected");
                }
                break;
            case "q":  // q = deselect all
                if (lms) {
                    app.landmarks().deselectAll();
                    $('#viewportContainer').trigger("groupDeselected");
                }
                break;
            case "r":  // r = [r]eset camera
                // TODO fix for multiple cameras (should be in camera controller)
                viewport.resetCamera();
                break;
            case "t":  // t = toggle [t]exture (mesh mode only)
                if (app.meshMode()) {
                    app.asset().textureToggle();
                }
                break;
            case "a":  // a = select [a]ll
                if (lms) {
                    app.landmarks().selectAll();
                    $('#viewportContainer').trigger("groupSelected");
                }
                break;
            case "g":  // g = complete [g]roup selection
                $('#viewportContainer').trigger("completeGroupSelection");
                break;
            case "c":  // c = toggle [c]amera mode
                if (app.meshMode()) {
                    viewport.toggleCamera();
                }
                break;
            case "j":  // j = down, next asset
                app.nextAsset();
                break;
            case "k":  // k = up, previous asset
                app.previousAsset();
                break;
            case "l":  // l = toggle [l]inks
                app.toggleConnectivity();
                break;
            case "e":  // e = toggle [e]dit mode
                app.toggleEditing();
                break;
            case "z": // z = undo
                if (lms && lms.tracker.canUndo()) {
                    lms.undo();
                }
                break;
            case "y": // y = redo
                if (lms && lms.tracker.canRedo()) {
                    lms.redo();
                }
                break;
            case "?": // toggle help
                app.toggleHelpOverlay();
                break;
            case "+":
                app.incrementLandmarkSize();
                break;
            case "-":
                app.decrementLandmarkSize();
                break;
        }
    };

    this._keydown = function (evt) {
        let lms;

        if (evt.which === 27) {
            if (app.isHelpOverlayOn()) {
                app.toggleHelpOverlay();
                evt.stopPropagation();
                return null;
            }

            const modal = Modal.active();
            if (modal) {
                if (modal.closable) {
                    modal.close();
                }
                evt.stopPropagation();
                return null;
            }

            if ($('#templatePicker').hasClass('Active')) {
                $('#templatePicker').removeClass('Active');
                return null;
            }

            lms = app.landmarks();
            if (lms) {
                app.landmarks().deselectAll();
                $('#viewportContainer').trigger("groupDeselected");
                evt.stopPropagation();
                return null;
            }
        } else if (evt.which === 83 && (evt.metaKey || evt.ctrlKey)) {
            evt.preventDefault();
            lms = app.landmarks();
            if (lms) {
                lms.save();
            }
        }
    };
}

KeyboardShortcutsHandler.prototype.enable = function () {
    $(window).on('keypress', this._keypress);
    $(window).on('keydown', this._keydown);
};

KeyboardShortcutsHandler.prototype.disable = function () {
    $(window).off('keypress', this._keypress);
    $(window).off('keydown', this._keydown);
};
