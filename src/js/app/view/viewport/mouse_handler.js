/*
    Creates a closured handler for handling mouse events
    In order to bind the closure to the viewport as `this`, use with apply:

        this.handler = MouseHandler.apply(this);
 */
"use strict";

var _ = require('underscore');
var THREE = require('three');
var $ = require('jquery');

var atomic = require('../../model/atomic');

const MOVE_THROTTLE = 50;

function MouseHandler () {

    // Helpers
    // ------------------------------------------------------------------------

    /**
     * Find the 4 landmarks closest to a location (THREE vector)
     * from a LandmarkGroup
     *
     * @param  {LandmarkGroup} lmGroup
     * @param  {THREE.Vector} loc
     *
     * @return {Landmark[]}
     */
    var findClosestLandmarks = (lmGroup, loc, locked=false) => {
        var dist, i, j,
            lm, lmLoc,
            minDist, minLm,
            dists = new Array(4), lms= new Array(4);

        for (i = lmGroup.landmarks.length - 1; i >= 0; i--) {
            lm = lmGroup.landmarks[i];
            lmLoc = lm.point();

            if (lmLoc === null || (locked && lm === selectedLm)) {
                continue;
            }

            dist = loc.distanceTo(lmLoc);

            // Compare to stored lm in order, 0 being the closest
            for (j = 0; j < 3; j++) {
                minDist = dists[j];
                if (!minDist) {
                    [dists[j], lms[j]] = [dist, lm];
                    break;
                } else if (dist <= minDist) { // leq to ensure we always have 4
                    dists.splice(j, 0, dist);
                    lms.splice(j, 0, lm);
                    break;
                }
            }
        }

        return lms;
    }

    // Setup handler state variables
    // ------------------------------------------------------------------------
    var downEvent,
        lmPressed, lmPressedWasSelected,
        isPressed, hasGroupSelection,
        selectedLm;

    // x, y position of mouse on click states
    var onMouseDownPosition = new THREE.Vector2(),
        onMouseUpPosition = new THREE.Vector2();

    // current screen position when in drag state
    var positionLmDrag = new THREE.Vector2();
    // vector difference in one time step
    var deltaLmDrag = new THREE.Vector2();

    var intersectsWithLms, intersectsWithMesh;

    var meshPressed = () => {
        console.log('mesh pressed!');
        hasGroupSelection = false;
        if (event.button === 0 && event.shiftKey) {
            shiftPressed();  // LMB + SHIFT
        } else {
            $(document).one('mouseup.viewportMesh', meshOnMouseUp);
        }
    }

    var landmarkPressed = () => {
        var ctrl = (downEvent.ctrlKey || downEvent.metaKey);
        console.log('Viewport: landmark pressed');
        // before anything else, disable the camera
        this.cameraController.disable();
        // the clicked on landmark
        var landmarkSymbol = intersectsWithLms[0].object;
        // hunt through the landmarkViews for the right symbol
        for (var i = 0; i < this.landmarkViews.length; i++) {
            if (this.landmarkViews[i].symbol === landmarkSymbol) {
                lmPressed = this.landmarkViews[i].model;
            }
        }
        console.log('Viewport: finding the selected points');
        lmPressedWasSelected = lmPressed.isSelected();
        if (!lmPressedWasSelected && !ctrl) {
            // this lm wasn't pressed before and we aren't holding
            // mutliselection down - deselect rest and select this
            console.log("normal click on a unselected lm - deselecting rest and selecting me");
            lmPressed.selectAndDeselectRest();
        }
        if (ctrl && !lmPressedWasSelected) {
            lmPressed.select();
        }

        // record the position of where the drag started.
        positionLmDrag.copy(this.localToScreen(lmPressed.point()));
        // start listening for dragging landmarks
        $(document).on('mousemove.landmarkDrag', landmarkOnDrag);
        $(document).one(
            'mouseup.viewportLandmark', landmarkOnMouseUp);
    }

    var nothingPressed = () => {
        console.log('nothing pressed!');
        hasGroupSelection = false;
        $(document).one(
            'mouseup.viewportNothing', nothingOnMouseUp);
    }

    var shiftPressed = () => {
        console.log('shift pressed!');
        // before anything else, disable the camera
        hasGroupSelection = false;
        this.cameraController.disable();
        $(document).on('mousemove.shiftDrag', shiftOnDrag);
        $(document).one('mouseup.viewportShift', shiftOnMouseUp);
    }

    // Handle pressing the mouse
    // ------------------------------------------------------------------------

    // Catch all clicks and delegate to other handlers once user's intent
    // has been figured out
    var onMouseDown = (event) => {
        event.preventDefault();
        this.$el.focus();

        isPressed = true;

        downEvent = event;
        onMouseDownPosition.set(event.clientX, event.clientY);

        // All interactions require intersections to distinguish
        intersectsWithLms = this.getIntersectsFromEvent(
            event, this.s_lms);
        // note that we explicitly ask for intersects with the mesh
        // object as we know get intersects will use an octree if
        // present.
        intersectsWithMesh = this.getIntersectsFromEvent(
            event, this.mesh);

        if (event.button === 0) {  // left mouse button
            if (intersectsWithLms.length > 0 &&
                intersectsWithMesh.length > 0) {
                // degenerate case - which is closer?
                if (intersectsWithLms[0].distance <
                    intersectsWithMesh[0].distance) {
                    landmarkPressed(event);
                } else {
                    // the mesh was pressed. Check for shift first.
                    if (event.shiftKey) {
                        shiftPressed();
                    } else {
                        meshPressed();
                    }
                }
            } else if (intersectsWithLms.length > 0) {
                landmarkPressed(event);
            } else if (event.shiftKey) {
                // shift trumps all!
                shiftPressed();
            } else if (intersectsWithMesh.length > 0) {
                meshPressed();
            } else {
                nothingPressed();
            }
        }
    };


    // Drag Handlers
    // ------------------------------------------------------------------------

    var landmarkOnDrag = atomic.atomicOperation((event) => {
        console.log("drag");
        // note that positionLmDrag is set to where we started.
        // update where we are now and where we were
        var newPositionLmDrag = new THREE.Vector2(
            event.clientX, event.clientY);
        var prevPositionLmDrag = positionLmDrag.clone();
        // change in this step in screen space
        deltaLmDrag.subVectors(newPositionLmDrag, prevPositionLmDrag);
        // update the position
        positionLmDrag.copy(newPositionLmDrag);
        var selectedLandmarks = this.model.landmarks().selected();
        var lm, vScreen;
        for (var i = 0; i < selectedLandmarks.length; i++) {
            lm = selectedLandmarks[i];
            // convert to screen coordinates
            vScreen = this.localToScreen(lm.point());

            // budge the screen coordinate
            vScreen.add(deltaLmDrag);

            // use the standard machinery to find intersections
            // note that we intersect the mesh to use the octree
            intersectsWithMesh = this.getIntersects(vScreen.x,
                vScreen.y, this.mesh);
            if (intersectsWithMesh.length > 0) {
                // good, we're still on the mesh.
                lm.setPoint(this.s_meshAndLms.worldToLocal(
                    intersectsWithMesh[0].point.clone()));
            } else {
                // don't update point - it would fall off the surface.
                console.log("fallen off mesh");
            }
        }
    });

    var shiftOnDrag = (event) => {
        console.log("shift:drag");
        // note - we use client as we don't want to jump back to zero
        // if user drags into sidebar!
        var newX = event.clientX;
        var newY = event.clientY;
        // clear the canvas and draw a selection rect.
        this.clearCanvas();
        var x = onMouseDownPosition.x;
        var y = onMouseDownPosition.y;
        var dx = newX - x;
        var dy = newY - y;
        this.ctx.strokeRect(x, y, dx, dy);
    };

    // Up handlers
    // ------------------------------------------------------------------------

    var shiftOnMouseUp = atomic.atomicOperation((event) => {
        this.cameraController.enable();
        console.log("shift:up");
        $(document).off('mousemove.shiftDrag', shiftOnDrag);
        var x1 = onMouseDownPosition.x;
        var y1 = onMouseDownPosition.y;
        var x2 = event.clientX;
        var y2 = event.clientY;
        var min_x, max_x, min_y, max_y;
        if (x1 < x2) {
            min_x = x1;
            max_x = x2;
        } else {
            min_x = x2;
            max_x = x1;
        }
        if (y1 < y2) {
            min_y = y1;
            max_y = y2;
        } else {
            min_y = y2;
            max_y = y1;
        }
        // First, let's just find all the landmarks in screen space that
        // are within our selection.
        var lms = this.lmViewsInSelectionBox(min_x, min_y,
                                             max_x, max_y);

        // Of these, filter out the ones which are visible (not
        // obscured) and select the rest
        _.each(lms, (lm) => {
            if (this.lmViewVisible(lm)) {
                lm.model.select();
            }
        });

        this.clearCanvas();
        isPressed = false;
        hasGroupSelection = true;
    });

    var meshOnMouseUp = (event) => {
        console.log("meshPress:up");
        var p;
        onMouseUpPosition.set(event.clientX, event.clientY);
        if (onMouseDownPosition.distanceTo(onMouseUpPosition) < 2) {
            //  a click on the mesh
            p = intersectsWithMesh[0].point.clone();
            // Convert the point back into the mesh space
            this.s_meshAndLms.worldToLocal(p);
            this.model.landmarks().insertNew(p);
        }

        this.clearCanvas();
        isPressed = false;
        hasGroupSelection = false;
    };

    var nothingOnMouseUp = (event) => {
        console.log("nothingPress:up");
        onMouseUpPosition.set(event.clientX, event.clientY);
        if (onMouseDownPosition.distanceTo(onMouseUpPosition) < 2) {
            // a click on nothing - deselect all
            this.model.landmarks().deselectAll();
        }

        this.clearCanvas();
        isPressed = false;
        hasGroupSelection = false;
    };

    var landmarkOnMouseUp = atomic.atomicOperation((event) => {
        var ctrl = downEvent.ctrlKey || downEvent.metaKey;
        this.cameraController.enable();
        console.log("landmarkPress:up");
        $(document).off('mousemove.landmarkDrag');
        onMouseUpPosition.set(event.clientX, event.clientY);
        if (onMouseDownPosition.distanceTo(onMouseUpPosition) === 0) {
            // landmark was pressed
            if (lmPressedWasSelected && ctrl) {
                lmPressed.deselect();
            } else if (!ctrl) {
                lmPressed.selectAndDeselectRest();
            }
        }

        this.clearCanvas();
        isPressed = false;
    });

    // Move handlers
    // ------------------------------------------------------------------------

    var onMouseMove = (evt) => {
        this.clearCanvas();

        if (isPressed || !this.model.isEditingOn()) {
            return null;
        }

        var intersectsWithMesh =
            this.getIntersectsFromEvent(evt, this.mesh);

        var lmGroup = this.model.landmarks();

        var shouldUpdate = (intersectsWithMesh.length > 0 &&
                            lmGroup &&
                            lmGroup.landmarks);

        if (!shouldUpdate) {
            return null;
        }

        var mouseLoc = this.s_meshAndLms.worldToLocal(
            intersectsWithMesh[0].point.clone());

        var lms = findClosestLandmarks(lmGroup, mouseLoc,
                                       evt.ctrlKey || evt.metaKey);

        if (lms[0] && !evt.ctrlKey) {
            selectedLm = lms[0];
            lms = lms.slice(1, 4);
        } else if (lms[0]) {
            lms = lms.slice(0, 3);
        }

        if (selectedLm) { // Always happens while we have _selectedLm

            if (!hasGroupSelection) {
                selectedLm.selectAndDeselectRest();
                selectedLm.setNextAvailable();
            }

            this.drawTargetingLine(
                {x: evt.clientX, y: evt.clientY},
                this.localToScreen(selectedLm.point()));

            lms.forEach((lm) => {
                this.drawTargetingLine(
                    {x: evt.clientX, y: evt.clientY},
                    this.localToScreen(lm.point()), true);
            });
        }
    };

    return {
        onMouseDown: atomic.atomicOperation(onMouseDown),
        onMouseMove: _.throttle(atomic.atomicOperation(onMouseMove),
                                MOVE_THROTTLE)
    }

}

module.exports = MouseHandler;
