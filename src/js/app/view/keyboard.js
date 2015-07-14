'use strict';

import $ from 'jquery';

import Modal from './modal';

export default function KeyboardShortcutsHandler (app, viewport) {
    this._keypress = function (e) {
        // Don't fire on input fields
        if ($(e.target).closest("input")[0]) {
            return;
        }

        const key = e.which;

        if ((app.isHelpOverlayOn() || !!Modal.active()) && key !== 63) {
            return;
        }

        const lms = app.landmarks();

        switch (key) {
            case 100:  // d = [d]elete selected
                if (lms) {
                    lms.deleteSelected();
                    $('#viewportContainer').trigger("groupDeselected");
                }
                break;
            case 113:  // q = deselect all
                if (lms) {
                    app.landmarks().deselectAll();
                    $('#viewportContainer').trigger("groupDeselected");
                }
                break;
            case 114:  // r = [r]eset camera
                // TODO fix for multiple cameras (should be in camera controller)
                viewport.resetCamera();
                break;
            case 116:  // t = toggle [t]exture (mesh mode only)
                if (app.meshMode()) {
                    app.asset().textureToggle();
                }
                break;
            case 97:  // a = select [a]ll
                if (lms) {
                    app.landmarks().selectAll();
                    $('#viewportContainer').trigger("groupSelected");
                }
                break;
            case 103:  // g = complete [g]roup selection
                $('#viewportContainer').trigger("completeGroupSelection");
                break;
            case 99:  // c = toggle [c]amera mode
                if (app.meshMode()) {
                    viewport.toggleCamera();
                }
                break;
            case 106:  // j = down, next asset
                app.nextAsset();
                break;
            case 107:  // k = up, previous asset
                app.previousAsset();
                break;
            case 108:  // l = toggle [l]inks
                app.toggleConnectivity();
                break;
            case 101:  // e = toggle [e]dit mode
                app.toggleEditing();
                break;
            case 122: // z = undo
                if (lms && lms.log.hasOperations()) {
                    lms.undo();
                }
                break;
            case 121: // z = undo
                if (lms && lms.log.hasUndone()) {
                    lms.redo();
                }
                break;
            case 63: // toggle help
                app.toggleHelpOverlay();
                break;
        }
    };

    this._keydown = function (evt) {
        if (evt.which !== 27) {
            return;
        }

        if (app.isHelpOverlayOn()) {
            app.toggleHelpOverlay();
            return;
        }

        const modal = Modal.active();
        if (modal) {
            if (modal.closable) {
                modal.close();
            }
            return;
        }

        const lms = app.landmarks();
        if (lms) {
            app.landmarks().deselectAll();
            $('#viewportContainer').trigger("groupDeselected");
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
