'use strict';

import _ from 'underscore';
import THREE from 'three';
import $ from 'jquery';

import atomic from '../../model/atomic';

/**
 * Holds state usable by all event handlers and should be bound to the
 * Viewport view instance.
 */
export default class Handler {

    constructor(viewport, model) {
        this.viewport = viewport;
        this.model = model;

        // Setup handler state variables
        // ------------------------------------------------------------------------
        this.currentTargetLm = undefined;
        this.downEvent = null;

        this.lmPressed = false;
        this.lmPressedWasSelected = false;
        this.isPressed = false;
        this.groupSelected = false;

        // x, y position of mouse on click states
        this.onMouseDownPosition = new THREE.Vector2();
        this.onMouseUpPosition = new THREE.Vector2();

        // current screen position when in drag state
        this.positionLmDrag = new THREE.Vector2();

        // vector difference in one time step
        this.deltaLmDrag = new THREE.Vector2();


        this.dragStartPositions = [];
        this.dragged = false;

        this.intersectsWithLms = [];
        this.intersectsWithMesh = [];
    }

    // High level handlers
    // these functions respond to changes in the mesh and landamrks state.
    // lower level handlers below reponding to raw input (e.g. onMouseDown) will
    // resolve what item is being interacted with and delegate to these methods
    // as appropriate.
    // ------------------------------------------------------------------------

    meshPressed = () => {
        console.log('mesh pressed!');
        if (this.groupSelected) {
            this.nothingPressed();
        } else if (this.downEvent.button === 0 && this.downEvent.shiftKey) {
            this.shiftPressed();  // LMB + SHIFT
        } else {
            $(document).one('mouseup.viewportMesh', this.meshOnMouseUp);
        }
    };

    landmarkPressed = () => {
        var ctrl = this.downEvent.ctrlKey || this.downEvent.metaKey;
        console.log('Viewport: landmark pressed');
        // before anything else, disable the camera
        this.viewport.cameraController.disable();
        // the clicked on landmark
        var landmarkSymbol = this.intersectsWithLms[0].object;
        // hunt through the landmarkViews for the right symbol
        for (var i = 0; i < this.viewport._landmarkViews.length; i++) {
            if (this.viewport._landmarkViews[i].symbol === landmarkSymbol) {
                this.lmPressed = this.viewport._landmarkViews[i].model;
            }
        }
        console.log('Viewport: finding the selected points');
        this.lmPressedWasSelected = this.lmPressed.isSelected();

        if (!this.lmPressedWasSelected && !ctrl) {
            // this lm wasn't pressed before and we aren't holding
            // mutliselection down - deselect rest and select this
            console.log("normal click on a unselected lm - deselecting rest and selecting me");
            this.lmPressed.selectAndDeselectRest();
        } else if (ctrl && !this.lmPressedWasSelected) {
            this.lmPressed.select();
        }

        // record the position of where the drag started.
        this.positionLmDrag.copy(this.viewport._localToScreen(this.lmPressed.point()));
        this.dragStartPositions = this.model.landmarks().selected().map(
            lm => [lm.index(), lm.point().clone()]);

        // start listening for dragging landmarks
        $(document).on('mousemove.landmarkDrag', this.landmarkOnDrag);
        $(document).one('mouseup.viewportLandmark', this.landmarkOnMouseUp);
    };

    nothingPressed = () => {
        console.log('nothing pressed!');
        $(document).one('mouseup.viewportNothing', this.nothingOnMouseUp);
    };

    shiftPressed = () => {
        console.log('shift pressed!');
        // before anything else, disable the camera
        this.viewport.cameraController.disable();

        if (!(this.downEvent.ctrlKey || this.downEvent.metaKey)) {
            this.deselectAll();
        }

        $(document).on('mousemove.shiftDrag', this.shiftOnDrag);
        $(document).one('mouseup.viewportShift', this.shiftOnMouseUp);
    };

    deselectAll = () => {
        const lms = this.model.landmarks();
        if (lms) {
            lms.deselectAll();
        }
    };

    // Catch all clicks and delegate to other handlers once user's intent
    // has been figured out
    onMouseDown = atomic.atomicOperation((event) => {
        event.preventDefault();
        this.viewport.$el.focus();

        if (!this.model.landmarks()) {
            return;
        }

        this.isPressed = true;

        this.downEvent = event;
        this.onMouseDownPosition.set(event.clientX, event.clientY);

        // All interactions require intersections to distinguish
        this.intersectsWithLms = this.viewport._getIntersectsFromEvent(
            event, this.viewport._sLms);
        // note that we explicitly ask for intersects with the mesh
        // object as we know get intersects will use an octree if
        // present.
        this.intersectsWithMesh = this.viewport._getIntersectsFromEvent(event, this.viewport.mesh);

        // Click type, we use MouseEvent.button which is the vanilla JS way
        // jQuery also exposes event.which which has different bindings
        if (event.button === 0) {  // left mouse button
            if (this.intersectsWithLms.length > 0 &&
                this.intersectsWithMesh.length > 0) {
                // degenerate case - which is closer?
                if (this.intersectsWithLms[0].distance <
                    this.intersectsWithMesh[0].distance) {
                    this.landmarkPressed(event);
                } else {
                    // the mesh was pressed. Check for shift first.
                    if (event.shiftKey) {
                        this.shiftPressed();
                    } else if (this.viewport._editingOn && this.currentTargetLm) {
                        this.meshPressed();
                    } else {
                        this.nothingPressed();
                    }
                }
            } else if (this.intersectsWithLms.length > 0) {
                this.landmarkPressed(event);
            } else if (event.shiftKey) {
                // shift trumps all!
                this.shiftPressed();
            } else if (
                this.intersectsWithMesh.length > 0 &&
                this.viewport._editingOn
            ) {
                this.meshPressed();
            } else {
                this.nothingPressed();
            }
        } else if (event.button === 2) { // Right click
            if (
                this.intersectsWithLms.length <= 0 &&
                this.intersectsWithMesh.length > 0
            ) {
                this.deselectAll();
                this.currentTargetLm = undefined;
                this.meshPressed();
            }
        }
    });

    // Drag Handlers
    // ------------------------------------------------------------------------
    landmarkOnDrag = atomic.atomicOperation((event) => {
        console.log("drag");
        // note that positionLmDrag is set to where we started.
        // update where we are now and where we were
        var newPositionLmDrag = new THREE.Vector2(
            event.clientX, event.clientY);
        var prevPositionLmDrag = this.positionLmDrag.clone();
        // change in this step in screen space
        this.deltaLmDrag.subVectors(newPositionLmDrag, prevPositionLmDrag);
        // update the position
        this.positionLmDrag.copy(newPositionLmDrag);
        var selectedLandmarks = this.model.landmarks().selected();
        var lm, vScreen;
        for (var i = 0; i < selectedLandmarks.length; i++) {
            lm = selectedLandmarks[i];
            // convert to screen coordinates
            vScreen = this.viewport._localToScreen(lm.point());

            // budge the screen coordinate
            vScreen.add(this.deltaLmDrag);

            // use the standard machinery to find intersections
            // note that we intersect the mesh to use the octree
            this.intersectsWithMesh = this.viewport._getIntersects(
                vScreen.x, vScreen.y, this.viewport.mesh);
            if (this.intersectsWithMesh.length > 0) {
                // good, we're still on the mesh.
                this.dragged = !!this.dragged || true;
                lm.setPoint(this.viewport._worldToLocal(this.intersectsWithMesh[0].point));
            } else {
                // don't update point - it would fall off the surface.
                console.log("fallen off mesh");
            }
        }
    });

    shiftOnDrag = (event) => {
        console.log("shift:drag");
        // note - we use client as we don't want to jump back to zero
        // if user drags into sidebar!
        var newPosition = { x: event.clientX, y: event.clientY };
        // clear the canvas and draw a selection rect.
        this.viewport.clearCanvas();
        this.viewport._drawSelectionBox(this.onMouseDownPosition, newPosition);
    };

    // Up handlers
    // ------------------------------------------------------------------------

    shiftOnMouseUp = atomic.atomicOperation((event) => {
        this.viewport.cameraController.enable();
        console.log("shift:up");
        $(document).off('mousemove.shiftDrag', this.shiftOnDrag);
        var x1 = this.onMouseDownPosition.x;
        var y1 = this.onMouseDownPosition.y;
        var x2 = event.clientX;
        var y2 = event.clientY;
        var minX, maxX, minY, maxY;
        if (x1 < x2) {
            [minX, maxX] = [x1, x2];
        } else {
            [minX, maxX] = [x2, x1];
        }
        if (y1 < y2) {
            [minY, maxY] = [y1, y2];
        } else {
            [minY, maxY] = [y2, y1];
        }
        // First, let's just find all the landmarks in screen space that
        // are within our selection.
        var lms = this.viewport._lmViewsInSelectionBox(minX, minY, maxX, maxY);

        // Of these, filter out the ones which are visible (not
        // obscured) and select the rest
        _.each(lms, (lm) => {
            if (this.viewport._lmViewVisible(lm)) {
                lm.model.select();
            }
        });

        this.viewport.clearCanvas();
        this.isPressed = false;
        this.setGroupSelected(true);
    });

    meshOnMouseUp = (event) => {
        console.log("meshPress:up");
        var p;
        this.onMouseUpPosition.set(event.clientX, event.clientY);
        if (this.onMouseDownPosition.distanceTo(this.onMouseUpPosition) < 2) {
            //  a click on the mesh
            p = this.intersectsWithMesh[0].point.clone();
            // Convert the point back into the mesh space
            this.viewport._worldToLocal(p, true);

            if (
                this.viewport._editingOn &&
                this.currentTargetLm &&
                this.currentTargetLm.group() === this.model.landmarks() &&
                !this.currentTargetLm.isEmpty()
            ) {
                this.model.landmarks().setLmAt(this.currentTargetLm, p);
            } else if (this.downEvent.button === 2) {
                this.model.landmarks().insertNew(p);
            }
        }

        this.viewport.clearCanvas();
        this.isPressed = false;
        this.setGroupSelected(false);
    };

    nothingOnMouseUp = (event) => {
        console.log("nothingPress:up");
        this.onMouseUpPosition.set(event.clientX, event.clientY);
        if (this.onMouseDownPosition.distanceTo(this.onMouseUpPosition) < 2) {
            // a click on nothing - deselect all
            this.setGroupSelected(false);
        }

        this.viewport.clearCanvas();
        this.isPressed = false;
    };

    landmarkOnMouseUp = atomic.atomicOperation((event) => {
        var ctrl = this.downEvent.ctrlKey || this.downEvent.metaKey;
        this.viewport.cameraController.enable();
        console.log("landmarkPress:up");
        $(document).off('mousemove.landmarkDrag');
        this.onMouseUpPosition.set(event.clientX, event.clientY);
        if (this.onMouseDownPosition.distanceTo(this.onMouseUpPosition) === 0) {
            // landmark was pressed
            if (this.lmPressedWasSelected && ctrl) {
                this.lmPressed.deselect();
            } else if (!ctrl && !this.lmPressedWasSelected) {
                this.lmPressed.selectAndDeselectRest();
            } else if (this.lmPressedWasSelected) {
                var p = this.intersectsWithMesh[0].point.clone();
                this.viewport._worldToLocal(p, true);
                this.model.landmarks().setLmAt(this.lmPressed, p);
            } else if (ctrl) {
                this.setGroupSelected(true);
            }
        } else if (this.dragged) {
            this.model.landmarks().selected().forEach((lm, i) => {
                this.dragStartPositions[i].push(lm.point().clone());
            });
            this.model.landmarks().tracker.record(this.dragStartPositions);
        }

        this.viewport.clearCanvas();
        this.dragged = false;
        this.dragStartPositions = [];
        this.isPressed = false;
    });

    // Move handlers
    // ------------------------------------------------------------------------
    onMouseMove = atomic.atomicOperation((evt) => {

        this.viewport.clearCanvas();

        if (this.isPressed ||
            !this.viewport._editingOn ||
            !this.model.landmarks() ||
            this.model.landmarks().isEmpty()
        ) {
            return null;
        }

        if (
            this.currentTargetLm &&
            (this.currentTargetLm.isEmpty() ||
            this.model.landmarks() !== this.currentTargetLm.group())
        ) {
            this.currentTargetLm = undefined;
        }

        this.intersectsWithMesh = this.viewport._getIntersectsFromEvent(evt, this.viewport.mesh);

        var lmGroup = this.model.landmarks();

        var shouldUpdate = this.intersectsWithMesh.length > 0 &&
                           lmGroup &&
                           lmGroup.landmarks;

        if (!shouldUpdate) {
            return null;
        }

        var mouseLoc = this.viewport._worldToLocal(this.intersectsWithMesh[0].point);
        var previousTargetLm = this.currentTargetLm;

        var lms = this.findClosestLandmarks(lmGroup, mouseLoc, evt.ctrlKey || evt.metaKey);

        if (lms[0] && !evt.ctrlKey) {
            this.currentTargetLm = lms[0];
            lms = lms.slice(1, 4);
        } else if (lms[0]) {
            lms = lms.slice(0, 3);
        }

        if (this.currentTargetLm && !this.groupSelected && lms.length > 0) {

            if (this.currentTargetLm !== previousTargetLm) {
                // Linear operation hence protected
                this.currentTargetLm.selectAndDeselectRest();
            }

            this.viewport._drawTargetingLines({x: evt.clientX, y: evt.clientY},
                this.currentTargetLm, lms);
        }
    });

    // Keyboard handlers
    // ------------------------------------------------------------------------
    onKeypress = atomic.atomicOperation((evt) => {
        // Only work in group selection mode
        if (
            !this.groupSelected || !this.model.landmarks() ||
            evt.which < 37 || evt.which > 40
        ) {
            return;
        }

        // Up and down are inversed due to the way THREE handles coordinates
        const directions = {
            37: [-1, 0],    // Left
            38: [0, -1],     // Up
            39: [1, 0],     // Right
            40: [0, 1]     // Down
        }[evt.which];

        // Only operate on arrow keys
        if (directions === undefined) {
            return;
        }

        // Set a movement of 0.5% of the screen in the suitable direction
        const [x, y] = directions,
              move = new THREE.Vector2(),
              [dx, dy] = [.005 * window.innerWidth, .005 * window.innerHeight];

        move.set(x * dx, y * dy);

        const ops = [];
        this.model.landmarks().selected().forEach((lm) => {
            const lmScreen = this.viewport._localToScreen(lm.point());
            lmScreen.add(move);

            this.intersectsWithMesh = this.viewport._getIntersects(
                lmScreen.x, lmScreen.y, this.viewport.mesh);

            if (this.intersectsWithMesh.length > 0) {
                const pt = this.viewport._worldToLocal(this.intersectsWithMesh[0].point);
                ops.push([lm.index(), lm.point().clone(), pt.clone()]);
                lm.setPoint(pt);
            }
        });
        this.model.landmarks().tracker.record(ops);
    });

    // Group Selection hook
    // ------------------------------------------------------------------------
    setGroupSelected = atomic.atomicOperation((val=true) => {

        if (!this.model.landmarks()) {
            return;
        }

        const _val = !!val; // Force cast to boolean

        if (_val === this.groupSelected) {
            return; // Nothing to do here
        }

        this.groupSelected = _val;

        if (_val) {
            // Use keydown as keypress doesn't register arrows in some context
            $(window).on('keydown', this.onKeypress);
        } else {
            this.deselectAll();
            $(window).off('keydown', this.onKeypress);
        }

        this.viewport.clearCanvas();
    });

    completeGroupSelection = () => {

        if (!this.model.landmarks()) {
            return;
        }

        this.model.landmarks().completeGroups();

        this.setGroupSelected(true);
    };

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
    findClosestLandmarks = (lmGroup, loc, locked=false) => {
        var dist, i, j, lm, lmLoc, minDist,
            dists = new Array(4), lms = new Array(4);

        for (i = lmGroup.landmarks.length - 1; i >= 0; i--) {
            lm = lmGroup.landmarks[i];

            if (lm.isEmpty()) {
                continue;
            }

            lmLoc = lm.point();

            if (lmLoc === null || locked && lm === this.currentTargetLm) {
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
    };

}
