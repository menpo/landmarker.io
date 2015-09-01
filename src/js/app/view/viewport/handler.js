'use strict';

import _ from 'underscore';
import THREE from 'three';
import $ from 'jquery';

import atomic from '../../model/atomic';

/**
 * Create a closure for handling mouse events in viewport.
 * Holds state usable by all event handlers and should be bound to the
 * Viewport view instance.
 */
export default function Handler () {

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
        var dist, i, j, lm, lmLoc, minDist,
            dists = new Array(4), lms = new Array(4);

        for (i = lmGroup.landmarks.length - 1; i >= 0; i--) {
            lm = lmGroup.landmarks[i];

            if (lm.isEmpty()) {
                continue;
            }

            lmLoc = lm.point();

            if (lmLoc === null || locked && lm === currentTargetLm) {
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

    // Setup handler state variables
    // ------------------------------------------------------------------------
    var downEvent,
        lmPressed, lmPressedWasSelected,
        isPressed, groupSelected,
        currentTargetLm;

    // x, y position of mouse on click states
    var onMouseDownPosition = new THREE.Vector2(),
        onMouseUpPosition = new THREE.Vector2();

    // current screen position when in drag state
    var positionLmDrag = new THREE.Vector2();
    // vector difference in one time step
    var deltaLmDrag = new THREE.Vector2();
    var dragStartPositions, dragged = false;

    var intersectsWithLms, intersectsWithMesh;

    var landmarkOnDrag, shiftOnDrag,
        landmarkOnMouseUp, nothingOnMouseUp, shiftOnMouseUp,
        setGroupSelected;

    // Press handling
    // ------------------------------------------------------------------------

    var meshPressed = () => {
        console.log('mesh pressed!');
        if (groupSelected) {
            nothingPressed();
        } else if (downEvent.button === 0 && downEvent.shiftKey) {
            shiftPressed();  // LMB + SHIFT
        } else {
            $(document).one('mouseup.viewportMesh', meshOnMouseUp);
        }
    };

    var landmarkPressed = () => {
        var ctrl = downEvent.ctrlKey || downEvent.metaKey;
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
        } else if (ctrl && !lmPressedWasSelected) {
            lmPressed.select();
        }

        // record the position of where the drag started.
        positionLmDrag.copy(this.localToScreen(lmPressed.point()));
        dragStartPositions = this.model.landmarks().selected().map(
            lm => [lm.get('index'), lm.point().clone()]);

        // start listening for dragging landmarks
        $(document).on('mousemove.landmarkDrag', landmarkOnDrag);
        $(document).one('mouseup.viewportLandmark', landmarkOnMouseUp);
    };

    var nothingPressed = () => {
        console.log('nothing pressed!');
        $(document).one('mouseup.viewportNothing', nothingOnMouseUp);
    };

    var shiftPressed = () => {
        console.log('shift pressed!');
        // before anything else, disable the camera
        this.cameraController.disable();

        if (!(downEvent.ctrlKey || downEvent.metaKey)) {
            this.model.landmarks().deselectAll();
        }

        $(document).on('mousemove.shiftDrag', shiftOnDrag);
        $(document).one('mouseup.viewportShift', shiftOnMouseUp);
    };

    // Catch all clicks and delegate to other handlers once user's intent
    // has been figured out
    var onMouseDown = (event) => {
        event.preventDefault();
        this.$el.focus();

        if (!this.model.landmarks()) {
            return;
        }

        isPressed = true;

        downEvent = event;
        onMouseDownPosition.set(event.clientX, event.clientY);

        // All interactions require intersections to distinguish
        intersectsWithLms = this.getIntersectsFromEvent(
            event, this.sLms);
        // note that we explicitly ask for intersects with the mesh
        // object as we know get intersects will use an octree if
        // present.
        intersectsWithMesh = this.getIntersectsFromEvent(event, this.mesh);

        // Click type, we use MouseEvent.button which is the vanilla JS way
        // jQuery also exposes event.which which has different bindings
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
                    } else if (this.model.isEditingOn() && currentTargetLm) {
                        meshPressed();
                    } else {
                        nothingPressed();
                    }
                }
            } else if (intersectsWithLms.length > 0) {
                landmarkPressed(event);
            } else if (event.shiftKey) {
                // shift trumps all!
                shiftPressed();
            } else if (
                intersectsWithMesh.length > 0 &&
                this.model.isEditingOn()
            ) {
                meshPressed();
            } else {
                nothingPressed();
            }
        } else if (event.button === 2) { // Right click
            if (
                intersectsWithLms.length <= 0 &&
                intersectsWithMesh.length > 0
            ) {
                this.model.landmarks().deselectAll();
                currentTargetLm = undefined;
                meshPressed();
            }
        }
    };

    // Drag Handlers
    // ------------------------------------------------------------------------

    landmarkOnDrag = atomic.atomicOperation((event) => {
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
            intersectsWithMesh = this.getIntersects(
                vScreen.x, vScreen.y, this.mesh);
            if (intersectsWithMesh.length > 0) {
                // good, we're still on the mesh.
                dragged = !!dragged || true;
                lm.setPoint(this.worldToLocal(intersectsWithMesh[0].point));
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
        this.clearCanvas();
        this.drawSelectionBox(onMouseDownPosition, newPosition);
    };

    // Up handlers
    // ------------------------------------------------------------------------

    shiftOnMouseUp = atomic.atomicOperation((event) => {
        this.cameraController.enable();
        console.log("shift:up");
        $(document).off('mousemove.shiftDrag', shiftOnDrag);
        var x1 = onMouseDownPosition.x;
        var y1 = onMouseDownPosition.y;
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
        var lms = this.lmViewsInSelectionBox(minX, minY, maxX, maxY);

        // Of these, filter out the ones which are visible (not
        // obscured) and select the rest
        _.each(lms, (lm) => {
            if (this.lmViewVisible(lm)) {
                lm.model.select();
            }
        });

        this.clearCanvas();
        isPressed = false;
        setGroupSelected(true);
    });

    var meshOnMouseUp = (event) => {
        console.log("meshPress:up");
        var p;
        onMouseUpPosition.set(event.clientX, event.clientY);
        if (onMouseDownPosition.distanceTo(onMouseUpPosition) < 2) {
            //  a click on the mesh
            p = intersectsWithMesh[0].point.clone();
            // Convert the point back into the mesh space
            this.worldToLocal(p, true);

            if (
                this.model.isEditingOn() &&
                currentTargetLm &&
                currentTargetLm.group() === this.model.landmarks() &&
                !currentTargetLm.isEmpty()
            ) {
                this.model.landmarks().setLmAt(currentTargetLm, p);
            } else if (downEvent.button === 2) {
                this.model.landmarks().insertNew(p);
            }
        }

        this.clearCanvas();
        isPressed = false;
        setGroupSelected(false);
    };

    nothingOnMouseUp = (event) => {
        console.log("nothingPress:up");
        onMouseUpPosition.set(event.clientX, event.clientY);
        if (onMouseDownPosition.distanceTo(onMouseUpPosition) < 2) {
            // a click on nothing - deselect all
            setGroupSelected(false);
        }

        this.clearCanvas();
        isPressed = false;
    };

    landmarkOnMouseUp = atomic.atomicOperation((event) => {
        var ctrl = downEvent.ctrlKey || downEvent.metaKey;
        this.cameraController.enable();
        console.log("landmarkPress:up");
        $(document).off('mousemove.landmarkDrag');
        onMouseUpPosition.set(event.clientX, event.clientY);
        if (onMouseDownPosition.distanceTo(onMouseUpPosition) === 0) {
            // landmark was pressed
            if (lmPressedWasSelected && ctrl) {
                lmPressed.deselect();
            } else if (!ctrl && !lmPressedWasSelected) {
                lmPressed.selectAndDeselectRest();
            } else if (lmPressedWasSelected) {
                var p = intersectsWithMesh[0].point.clone();
                this.worldToLocal(p, true);
                this.model.landmarks().setLmAt(lmPressed, p);
            } else if (ctrl) {
                setGroupSelected(true);
            }
        } else if (dragged) {
            this.model.landmarks().selected().forEach((lm, i) => {
                dragStartPositions[i].push(lm.point().clone());
            });
            this.model.landmarks().tracker.record(dragStartPositions);
        }

        this.clearCanvas();
        dragged = false;
        dragStartPositions = [];
        isPressed = false;
    });

    // Move handlers
    // ------------------------------------------------------------------------

    var onMouseMove = (evt) => {

        this.clearCanvas();

        if (isPressed ||
            !this.model.isEditingOn() ||
            !this.model.landmarks() ||
            this.model.landmarks().isEmpty()
        ) {
            return null;
        }

        if (
            currentTargetLm &&
            (currentTargetLm.isEmpty() ||
            this.model.landmarks() !== currentTargetLm.group())
        ) {
            currentTargetLm = undefined;
        }

        intersectsWithMesh = this.getIntersectsFromEvent(evt, this.mesh);

        var lmGroup = this.model.landmarks();

        var shouldUpdate = intersectsWithMesh.length > 0 &&
                           lmGroup &&
                           lmGroup.landmarks;

        if (!shouldUpdate) {
            return null;
        }

        var mouseLoc = this.worldToLocal(intersectsWithMesh[0].point);
        var previousTargetLm = currentTargetLm;

        var lms = findClosestLandmarks(lmGroup, mouseLoc,
                                       evt.ctrlKey || evt.metaKey);

        if (lms[0] && !evt.ctrlKey) {
            currentTargetLm = lms[0];
            lms = lms.slice(1, 4);
        } else if (lms[0]) {
            lms = lms.slice(0, 3);
        }

        if (currentTargetLm && !groupSelected && lms.length > 0) {

            if (currentTargetLm !== previousTargetLm) {
                // Linear operation hence protected
                currentTargetLm.selectAndDeselectRest();
            }

            this.drawTargetingLines({x: evt.clientX, y: evt.clientY},
                currentTargetLm, lms);
        }
    };

    // Keyboard handlers
    // ------------------------------------------------------------------------
    var onKeypress = atomic.atomicOperation((evt) => {
        // Only work in group selection mode
        if (
            !groupSelected || !this.model.landmarks() ||
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
            const lmScreen = this.localToScreen(lm.point());
            lmScreen.add(move);

            intersectsWithMesh = this.getIntersects(
                lmScreen.x, lmScreen.y, this.mesh);

            if (intersectsWithMesh.length > 0) {
                const pt = this.worldToLocal(intersectsWithMesh[0].point);
                ops.push([lm.get('index'), lm.point().clone(), pt.clone()]);
                lm.setPoint(pt);
            }
        });
        this.model.landmarks().tracker.record(ops);
    });

    // Group Selection hook
    // ------------------------------------------------------------------------

    setGroupSelected = (val=true) => {

        if (!this.model.landmarks()) {
            return;
        }

        const _val = !!val; // Force cast to boolean

        if (_val === groupSelected) {
            return; // Nothing to do here
        }

        groupSelected = _val;

        if (_val) {
            // Use keydown as keypress doesn't register arrows in some context
            $(window).on('keydown', onKeypress);
        } else {
            this.deselectAll();
            $(window).off('keydown', onKeypress);
        }

        this.clearCanvas();
    };

    var completeGroupSelection = () => {

        if (!this.model.landmarks()) {
            return;
        }

        this.model.landmarks().completeGroups();

        setGroupSelected(true);
    };

    return {
        // State management
        setGroupSelected: atomic.atomicOperation(setGroupSelected),
        completeGroupSelection: completeGroupSelection,

        // Exposed handlers
        onMouseDown: atomic.atomicOperation(onMouseDown),
        onMouseMove: atomic.atomicOperation(onMouseMove)
    };

}
