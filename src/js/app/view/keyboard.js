'use strict';

import $ from 'jquery';

import Modal from './modal';
import { notify } from './notification';
import { deleteAllSelectedLandmarks } from '../actions'
import store from '../reduxindex'

export default function KeyboardShortcutsHandler (app, viewport) {
    this._keypress = function (e) {

        // Don't fire on input fields
        if ($(e.target).closest("input[type='text']")[0]) {
            return null;
        }

        const key = e.which;

        if (app.isHelpOverlayOn() && key !== 63 || Modal.active()) {
            return null;
        }

        const lms = app.landmarks();

        switch (key) {
            case 19:  // s = [s]ave (normally 115 but switches to 19 with ctrl)
                if (lms && e.ctrlKey) {
                    lms.save().then( function () {
                        notify({type: 'success', msg: 'Save Completed'});
                    }, function () {
                        notify({type: 'error', msg: 'Save Failed'});
                    });
                }
                break;
            case 100:  // d = [d]elete selected
                if (lms) {
                    store.dispatch(deleteAllSelectedLandmarks());
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
                if (lms && lms.tracker.canUndo()) {
                    lms.undo();
                }
                break;
            case 121: // z = undo
                if (lms && lms.tracker.canRedo()) {
                    lms.redo();
                }
                break;
            case 63: // toggle help
                app.toggleHelpOverlay();
                break;
            case 43:
                app.incrementLandmarkSize();
                break;
            case 45:
                app.decrementLandmarkSize();
                break;
        }
    };

    this._keydown = function (evt) {
        if (evt.which !== 27) {
            return;
        }

        if (app.isHelpOverlayOn()) {
            app.toggleHelpOverlay();
            evt.stopPropagation();
            return;
        }

        const modal = Modal.active();
        if (modal) {
            if (modal.closable) {
                modal.close();
            }
            evt.stopPropagation();
            return;
        }

        if ($('#templatePicker').hasClass('Active')) {
            $('#templatePicker').removeClass('Active');
            return;
        }

        const lms = app.landmarks();
        if (lms) {
            app.landmarks().deselectAll();
            $('#viewportContainer').trigger("groupDeselected");
            evt.stopPropagation();
            return;
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
