'use strict';

import $ from 'jquery';
import _ from 'underscore';

import Modal from './modal';

const SHORTCUTS = {
    // Structure is [fn, acceptShift?, needLms?]
    // Shortcuts activated without SHIFT, but CAPS LOCK ok (letters)
    "d": [function (lms) { // d = [d]elete selected
        lms.deleteSelected();
        $('#viewportContainer').trigger("groupDeselected");
    }, false, true],

    "q": [function (lms) { // q = deselect all
        lms.deselectAll();
        $('#viewportContainer').trigger("groupDeselected");
    }, false, true],

    "r": [function (lms, app, viewport) { // r = [r]eset camera
        // TODO fix for multiple cameras (should be in camera controller)
        viewport.resetCamera();
    }, false, false],

    "t": [function (lms, app) { // t = toggle [t]exture (mesh mode only)
        if (app.meshMode()) {
            app.asset().textureToggle();
        }
    }, false, false],

    // "a": [function (lms, app) { // a = select [a]ll
    //     app.landmarks().selectAll();
    //     $('#viewportContainer').trigger("groupSelected");
    // }, false, true],

    "g": [function () { // g = complete [g]roup selection
        $('#viewportContainer').trigger("completeGroupSelection");
    }, false, true],

    "c": [function (lms, app, viewport) { // c = toggle [c]amera mode
        if (app.meshMode()) {
            viewport.toggleCamera();
        }
    }, false, false],

    "j": [function (lms, app) { // j = down, next asset
        app.nextAsset();
    }, false, false],

    "k": [function (lms, app) { // k = up, previous asset
        app.previousAsset();
    }, false, false],

    "l": [function (lms, app) { // l = toggle [l]inks
        app.toggleConnectivity();
    }, false, false],

    "e": [function (lms, app) { // e = toggle [e]dit mode
        app.toggleEditing();
    }, false, false],

    "y": [function (lms) { // y = redo
        if (lms && lms.tracker.canRedo()) {
            lms.redo();
        }
    }, false, true],

    // "z": [function (lms) { // z = undo
    //     if (lms && lms.tracker.canUndo()) {
    //         lms.undo();
    //     }
    // }, false, true],

    // Keys where shift key may be needed on certain keyboard layouts
    "?": [function (lms, app) {
        app.toggleHelpOverlay();
    }, true, false],

    "+": [function (lms, app) {
        app.incrementLandmarkSize();
    }, true, false],

    "-": [function (lms, app) {
        app.decrementLandmarkSize();
    }, true, false],

    // LM flag keys

    "z": [function (lms) { // z = mark as bad
        if (lms) {
            lms.markAsBad();
        }
    }, false, true],

    "a": [function (lms) { // a = mark as invisible
        if (lms) {
            lms.markAsInvisible();
        }
    }, false, true],

};

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
        const [fn, acceptShift, needLms] = SHORTCUTS[key] || [];
        if (
            fn &&
            (e.shiftKey && acceptShift || !e.shiftKey) &&
            (lms && needLms || !needLms)
        ) {
            fn(lms, app, viewport);
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
