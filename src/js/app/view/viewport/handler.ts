import * as THREE from 'three'
import * as $ from 'jquery'
import { Landmark } from './base' 
import atomic from '../../model/atomic'
import { Viewport } from './index'
import { Intersection } from './octree'

// Helpers
// ------------------------------------------------------------------------

const findClosestLandmarks = (lms: Landmark[], point: THREE.Vector, n = 4) =>
    lms
        .map(lm => ({ landmark: lm, distance: point.distanceTo(lm.point) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, n)
        .map(lmd => lmd.landmark);

/**
 * Holds state usable by all event handlers and should be bound to the
 * Viewport view instance.
 */
export default class Handler {
    
    viewport: Viewport
    _currentTargetLmIndex: number = null
    
    downEvent = null
    lmPressed: Landmark = null
    isPressed = false
    
    onMouseDownPosition = new THREE.Vector2()
    onMouseUpPosition = new THREE.Vector2()
    positionLmDrag =  new THREE.Vector2()
    
    dragStartPositions = []
    dragged = false
    intersectsWithLms: Intersection[] = []
    intersectsWithMesh: Intersection[] = []
    
    constructor(viewport: Viewport) {
        this.viewport = viewport
    }
    
    get currentTargetLm (): Landmark {
      return this._currentTargetLmIndex !== null ? 
          this.viewport._landmarks[this._currentTargetLmIndex] : 
          null
    }
    
    set currentTargetLm (targetLm: Landmark) {
        if (targetLm === null) {
            this._currentTargetLmIndex = null
        } else {
            this._currentTargetLmIndex = targetLm.index
        }
    }

    // High level handlers
    // these functions respond to changes in the mesh and landamrks state.
    // lower level handlers below reponding to raw input (e.g. onMouseDown) will
    // resolve what item is being interacted with and delegate to these methods
    // as appropriate.
    // ------------------------------------------------------------------------

    meshPressed = () => {
        console.log('mesh pressed!');
        if (this.viewport._groupModeActive) {
            this.nothingPressed();
        } else if (this.downEvent.button === 0 && this.downEvent.shiftKey) {
            this.shiftPressed();  // LMB + SHIFT
        } else {
            $(document).one('mouseup.viewportMesh', this.meshOnMouseUp);
        }
    };

    // called when the landmarks are changed on the viewport.
    resetLandmarks = () => {
        this.currentTargetLm = null
    };

    landmarkPressed = () => {
        var ctrl = this.downEvent.ctrlKey || this.downEvent.metaKey;
        console.log('Viewport: landmark pressed');
        // before anything else, disable the camera
        this.viewport.cameraController.disable();
        // the clicked on landmark
        var landmarkSymbol = this.intersectsWithLms[0].object;
        // hunt through the landmarkViews for the right symbol
        console.log(landmarkSymbol);

        this.viewport._landmarkViews
            .filter(lmv => lmv.symbol === landmarkSymbol)
            .forEach(lmv => this.lmPressed = this.viewport._landmarks[lmv.index]);
        console.log('Viewport: finding the selected points');

        if (!this.lmPressed.isSelected && !ctrl) {
            // this lm wasn't pressed before and we aren't holding
            // mutliselection down - deselect rest and select this
            console.log("normal click on a unselected lm - deselecting rest and selecting me");
            this.viewport.on.selectLandmarkAndDeselectRest(this.lmPressed.index);
        } else if (ctrl && !this.lmPressed.isSelected) {
            this.viewport.on.selectLandmarks([this.lmPressed.index]);
        }

        // record the position of where the drag started.
        this.positionLmDrag.copy(this.viewport._localToScreen(this.lmPressed.point));
        this.dragStartPositions = this.viewport._selectedLandmarks
            .map(lm => [lm.index, lm.point.clone()]);

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
            this.viewport.on.deselectAllLandmarks();
        }

        $(document).on('mousemove.shiftDrag', this.shiftOnDrag);
        $(document).one('mouseup.viewportShift', this.shiftOnMouseUp);
    };

    // Catch all clicks and delegate to other handlers once user's intent
    // has been figured out
    onMouseDown = atomic.atomicOperation(event => {
        event.preventDefault();
        this.viewport.$el.focus();

        if (!this.viewport._hasLandmarks) {
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
                    this.landmarkPressed();
                } else {
                    // the mesh was pressed. Check for shift first.
                    if (event.shiftKey) {
                        this.shiftPressed();
                    } else if (this.viewport._editingOn && this.currentTargetLm !== null) {
                        this.meshPressed();
                    } else {
                        this.nothingPressed();
                    }
                }
            } else if (this.intersectsWithLms.length > 0) {
                this.landmarkPressed();
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
                this.viewport.on.deselectAllLandmarks();
                this.currentTargetLm = null;
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

        // vector difference in one time step
        const deltaLmDrag = new THREE.Vector2();
        deltaLmDrag.subVectors(newPositionLmDrag, prevPositionLmDrag);
        // update the position
        this.positionLmDrag.copy(newPositionLmDrag);
        this.viewport._selectedLandmarks.forEach(lm => {
            // convert to screen coordinates
            const vScreen = this.viewport._localToScreen(lm.point);

            // budge the screen coordinate
            vScreen.add(deltaLmDrag);

            // use the standard machinery to find intersections
            // note that we intersect the mesh to use the octree
            this.intersectsWithMesh = this.viewport._getIntersects(
                vScreen.x, vScreen.y, this.viewport.mesh);
            if (this.intersectsWithMesh.length > 0) {
                // good, we're still on the mesh.
                this.dragged = !!this.dragged || true;
                this.viewport.on.setLandmarkPointWithHistory(lm.index,
                    this.viewport._worldToLocal(this.intersectsWithMesh[0].point));
            } else {
                // don't update point - it would fall off the surface.
                console.log("fallen off mesh");
            }
        })
    });

    shiftOnDrag = (event: MouseEvent) => {
        console.log("shift:drag");
        // note - we use client as we don't want to jump back to zero
        // if user drags into sidebar!
        var newPosition = new THREE.Vector2(event.clientX, event.clientY)
        // clear the canvas and draw a selection rect.
        this.viewport._clearCanvas();
        this.viewport._drawSelectionBox(this.onMouseDownPosition, newPosition);
    };

    // Up handlers
    // ------------------------------------------------------------------------

    shiftOnMouseUp = atomic.atomicOperation((event: MouseEvent) => {
        this.viewport.cameraController.enable();
        console.log("shift:up");
        $(document).off('mousemove.shiftDrag', this.shiftOnDrag);
        var x1 = this.onMouseDownPosition.x;
        var y1 = this.onMouseDownPosition.y;
        var x2 = event.clientX;
        var y2 = event.clientY;
        let minX: number, maxX: number, minY: number, maxY: number
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
        const indexesToSelect = lms.filter(this.viewport._lmViewVisible).map(lm => lm.index);
        this.viewport.on.selectLandmarks(indexesToSelect);
        this.viewport._clearCanvas();
        this.isPressed = false;
    });

    meshOnMouseUp = (event: MouseEvent) => {
        console.log("meshPress:up");
        this.onMouseUpPosition.set(event.clientX, event.clientY);
        if (this.onMouseDownPosition.distanceTo(this.onMouseUpPosition) < 2) {
            //  a click on the mesh
            // Convert the point back into the mesh space
            const p = this.viewport._worldToLocal(this.intersectsWithMesh[0].point)
            if (
                this.viewport._editingOn &&
                this.currentTargetLm !== null &&
                this.currentTargetLm.point !== null
            ) {
                // we are in edit mode - adjust the target point
                this.viewport.on.setLandmarkPoint(this.currentTargetLm.index, p)
            } else if (this.downEvent.button === 2) {
                // right click - insert point.
                this.viewport.on.insertNewLandmark(p)
            }
        }
        this.isPressed = false;
        this.viewport._clearCanvas();
    };

    nothingOnMouseUp = (event: MouseEvent) => {
        console.log("nothingPress:up");
        this.onMouseUpPosition.set(event.clientX, event.clientY);
        if (this.onMouseDownPosition.distanceTo(this.onMouseUpPosition) < 2) {
            // a click on nothing - deselect all
            this.viewport.on.deselectAllLandmarks();
        }
        this.isPressed = false;
        this.viewport._clearCanvas();
    };

    landmarkOnMouseUp = atomic.atomicOperation((event: MouseEvent) => {
        const ctrl = this.downEvent.ctrlKey || this.downEvent.metaKey;
        this.viewport.cameraController.enable();
        console.log("landmarkPress:up");
        $(document).off('mousemove.landmarkDrag');
        this.onMouseUpPosition.set(event.clientX, event.clientY);
        if (this.onMouseDownPosition.distanceTo(this.onMouseUpPosition) === 0) {
            // landmark was pressed
            if (this.lmPressed.isSelected && ctrl) {
                this.viewport.on.deselectLandmarks([this.lmPressed.index]);
            } else if (!ctrl && !this.lmPressed.isSelected) {
                this.viewport.on.selectLandmarkAndDeselectRest(this.lmPressed.index);
            } else if (this.lmPressed.isSelected) {
                const p = this.viewport._worldToLocal(this.intersectsWithMesh[0].point)
                this.viewport.on.setLandmarkPoint(this.lmPressed.index, p)
            }
        } else if (this.dragged) {
            this.viewport._selectedLandmarks.forEach((lm, i) => {
                this.dragStartPositions[i].push(lm.point.clone());
            });
            this.viewport.on.addLandmarkHistory(this.dragStartPositions);
        }

        this.viewport._clearCanvas();
        this.dragged = false;
        this.dragStartPositions = [];
        this.isPressed = false;
    });

    // Move handlers
    // ------------------------------------------------------------------------
    onMouseMove = atomic.atomicOperation((event: MouseEvent) => {

        this.viewport._clearCanvas();

        if (this.isPressed ||
            !this.viewport._editingOn ||
            !this.viewport._hasLandmarks ||
            this.viewport._allLandmarksEmpty ||
            this.viewport._groupModeActive
        ) {
            return null;
        }
        // only here as:
        // 1. Edit mode is enabled
        // 2. No group selection is made
        // 3. There is at least one landmark

        if (this.currentTargetLm !== null && this.currentTargetLm.point === null)
        {
            // the target point has been deleted - reset it.
            // TODO decide on reset state for target landmark
            this.currentTargetLm = null
        }

        this.intersectsWithMesh = this.viewport._getIntersectsFromEvent(event, this.viewport.mesh);

        if (this.intersectsWithMesh.length == 0) {
            // moving the mouse off the mesh does nothing.
            return null;
        }

        const mouseLoc = this.viewport._worldToLocal(this.intersectsWithMesh[0].point);

        // lock only works once we have an existing target landmark
        const lockEnabled = (event.ctrlKey || event.metaKey) && this.currentTargetLm !== null;

        let newTarget: Landmark, nextClosest: Landmark[] = [];
        if (lockEnabled) {
            // we will not change the existing target
            newTarget = this.currentTargetLm

            // only pick from the remaining landmarks
            const candidateLandmarks = this.viewport._nonEmptyLandmarks
                .filter(lm => lm.index !== this.currentTargetLm.index);
            nextClosest = findClosestLandmarks(candidateLandmarks, mouseLoc, 3)

        } else {
            // need to chose a new target landmark and new next closest
            [newTarget, ...nextClosest] = findClosestLandmarks(this.viewport._nonEmptyLandmarks, mouseLoc, 4)
        }

        // Remember, we know there are >= 1 landmarks, so we always have a newTarget.
        // Draw it and the next closest on the UI....
        this.viewport._drawTargetingLines(new THREE.Vector2(event.clientX, event.clientY),
            newTarget, nextClosest);

        // and if we have a change of new target, update the selection
        if (!this.currentTargetLm !== null || newTarget.index !== this.currentTargetLm.index) {
            // target has changed, which triggers a change in selection
            this.viewport.on.selectLandmarkAndDeselectRest(newTarget.index)

            // finally, update the current target lm for next time around.
            this.currentTargetLm = newTarget
        }
    });

}
