"use strict";

var $ = require('jquery');
var _ = require('underscore');
var Backbone = require('../lib/backbonej');
var THREE = require('three');

var Camera = require('./camera');
var atomic = require('../model/atomic');
var octree = require('../model/octree');

var { LandmarkConnectionTHREEView,
      LandmarkTHREEView,
      LandmarkTargetingTHREEView } = require('./elements');

// uncomment to monitor FPS performance
//
//var Stats = require('stats-js');
//
//var stats = new Stats();
//stats.setMode(0); // 0: fps, 1: ms
//
//// Align top-left
//stats.domElement.style.position = 'absolute';
//stats.domElement.style.right = '0px';
//stats.domElement.style.top = '0px';
//
//document.body.appendChild(stats.domElement);

// clear colour for both the main view and PictureInPicture
var CLEAR_COLOUR = 0xEEEEEE;
var CLEAR_COLOUR_PIP = 0xCCCCCC;

var MESH_MODE_STARTING_POSITION = new THREE.Vector3(1.0, 0.20, 1.5);
var IMAGE_MODE_STARTING_POSITION = new THREE.Vector3(0.0, 0.0, 1.0);

var PIP_WIDTH = 300;
var PIP_HEIGHT = 300;
var PIP_MARGIN = 0;

var MESH_SCALE = 1.0;

exports.Viewport = Backbone.View.extend({

    el: '#canvas',
    id: 'canvas',

    initialize: function () {

        // to debug window.viewport = this;


        // ----- CONFIGURATION ----- //
        this.meshScale = MESH_SCALE;  // The radius of the mesh's bounding sphere

        // TODO bind all methods on the Viewport
        _.bindAll(this, 'resize', 'render', 'changeMesh',
            'mousedownHandler', 'update', 'lmViewsInSelectionBox');

        // ----- DOM ----- //
        // We have three DOM concerns:
        //
        //  viewportContainer: a flexbox container for general UI sizing
        //    - vpoverlay: a Canvas overlay for 2D UI drawing
        //    - viewport: our THREE managed WebGL view
        //
        // The viewport and vpoverlay need to be position:fixed for WebGL
        // reasons. we listen for document resize and keep the size of these
        // two children in sync with the viewportContainer parent.
        this.$container = $('#viewportContainer');
        // and grab the viewport div
        this.$webglel = $('#viewport');
        // Get a hold on the overlay canvas and its context (note we use the
        // id - the Viewport should be passed the canvas element on
        // construction)
        this.canvas = document.getElementById(this.id);
        this.ctx = this.canvas.getContext('2d');

        // ------ SCENE GRAPH CONSTRUCTION ----- //
        this.scene = new THREE.Scene();

        // we use an initial top level to handle the absolute positioning of
        // the mesh and landmarks. Rotation and scale are applied to the
        // s_meshAndLms node directly.
        this.s_scaleRotate = new THREE.Object3D();
        this.s_translate = new THREE.Object3D();

        // ----- SCENE: MODEL AND LANDMARKS ----- //
        // s_meshAndLms stores the mesh and landmarks in the meshes original
        // coordinates. This is always transformed to the unit sphere for
        // consistency of camera.
        this.s_meshAndLms = new THREE.Object3D();
        // s_lms stores the scene landmarks. This is a useful container to
        // get at all landmarks in one go, and is a child of s_meshAndLms
        this.s_lms = new THREE.Object3D();
        this.s_meshAndLms.add(this.s_lms);
        // s_mesh is the parent of the mesh itself in the THREE scene.
        // This will only ever have one child (the mesh).
        // Child of s_meshAndLms
        this.s_mesh = new THREE.Object3D();
        this.s_meshAndLms.add(this.s_mesh);
        this.s_translate.add(this.s_meshAndLms);
        this.s_scaleRotate.add(this.s_translate);
        this.scene.add(this.s_scaleRotate);

        // ----- SCENE: CAMERA AND DIRECTED LIGHTS ----- //
        // s_camera holds the camera, and (optionally) any
        // lights that track with the camera as children
        this.s_oCam = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 20);
        this.s_oCamZoom = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 20);
        this.s_pCam = new THREE.PerspectiveCamera(50, 1, 0.02, 20);
        // start with the perspective camera as the main one
        this.s_camera = this.s_pCam;

        // create the cameraController to look after all camera state.
        this.cameraController = Camera.CameraController(
            this.s_pCam, this.s_oCam, this.s_oCamZoom,
            this.el, this.model.imageMode());

        // when the camera updates, render
        this.cameraController.on("change", this.update);

        if (!this.model.meshMode()) {
            // for images, default to orthographic camera
            // (note that we use toggle to make sure the UI gets updated)
            this.toggleCamera();
        }

        this.resetCamera();

        // ----- SCENE: GENERAL LIGHTING ----- //
        // TODO make lighting customizable
        // TODO no spot light for images
        this.s_lights = new THREE.Object3D();
        var pointLightLeft = new THREE.PointLight(0x404040, 1, 0);
        pointLightLeft.position.set(-100, 0, 100);
        this.s_lights.add(pointLightLeft);
        var pointLightRight = new THREE.PointLight(0x404040, 1, 0);
        pointLightRight.position.set(100, 0, 100);
        this.s_lights.add(pointLightRight);
        this.scene.add(this.s_lights);
        // add a soft white ambient light
        this.s_lights.add(new THREE.AmbientLight(0x404040));

        this.renderer = new THREE.WebGLRenderer({antialias: false,
                                                     alpha: false});
        this.renderer.setClearColor(CLEAR_COLOUR, 1);
        this.renderer.autoClear = false;
        // attach the render on the element we picked out earlier
        this.$webglel.html(this.renderer.domElement);

        // we  build a second scene for various helpers we may need
        // (intersection planes) and for connectivity information (so it
        // shows through)
        this.sceneHelpers = new THREE.Scene();

        // s_lmsconnectivity is used to store the connectivity representation
        // of the mesh. Note that we want
        this.s_lmsconnectivity = new THREE.Object3D();
        // we want to replicate the mesh scene graph in the scene helpers, so we can
        // have show-though connectivity..
        this.s_h_scaleRotate = new THREE.Object3D();
        this.s_h_translate = new THREE.Object3D();
        this.s_h_meshAndLms = new THREE.Object3D();
        this.s_h_meshAndLms.add(this.s_lmsconnectivity);
        this.s_h_translate.add(this.s_h_meshAndLms);
        this.s_h_scaleRotate.add(this.s_h_translate);
        this.sceneHelpers.add(this.s_h_scaleRotate);

        // add mesh if there already is one present (we could have missed a
        // backbone callback).
        this.changeMesh();

        // make an empty list of landmark views
        this.landmarkViews = [];
        this.connectivityViews = [];

        // Tools for moving between screen and world coordinates
        this.ray = new THREE.Raycaster();

        // ----- MOUSE HANDLER ----- //
        // There is quite a lot of finicky state in handling the mouse
        // interaction which is of no concern to the rest of the viewport.
        // We wrap all this complexity up in a closure so it can enjoy access
        // to the general viewport state without leaking it's state all over
        // the place.
        var that = this;
        this.isPressed = false;
        this.landmarkToEdit = undefined;

        this.handler = (function () {

            var downEvent, lmPressed, lmPressedWasSelected;
            // x, y position of mouse on click states
            var onMouseDownPosition = new THREE.Vector2();
            var onMouseUpPosition = new THREE.Vector2();

            // current screen position when in drag state
            var positionLmDrag = new THREE.Vector2();
            // vector difference in one time step
            var deltaLmDrag = new THREE.Vector2();

            var intersectsWithLms, intersectsWithMesh;

            // ----- OBJECT PICKING  ----- //

            // Catch all for mouse interaction. This is what is bound on the
            // canvas
            // and delegates to various other mouse handlers once it figures out
            // what the user has done.
            var onMouseDown = atomic.atomicOperation(function (event) {
                event.preventDefault();
                that.$el.focus();

                that.isPressed = true;

                downEvent = event;
                onMouseDownPosition.set(event.clientX, event.clientY);

                // All interactions require intersections to distinguish
                intersectsWithLms = that.getIntersectsFromEvent(
                    event, that.s_lms);
                // note that we explicitly ask for intersects with the mesh
                // object as we know get intersects will use an octree if
                // present.
                intersectsWithMesh = that.getIntersectsFromEvent(
                    event, that.mesh);

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

                function meshPressed() {
                    console.log('mesh pressed!');
                    if (event.button === 0 && event.shiftKey) {
                        shiftPressed();  // LMB + SHIFT
                    } else {
                        $(document).one('mouseup.viewportMesh', meshOnMouseUp);
                    }
                }

                function landmarkPressed() {
                    var ctrl = (downEvent.ctrlKey || downEvent.metaKey);
                    console.log('Viewport: landmark pressed');
                    // before anything else, disable the camera
                    that.cameraController.disable();
                    // the clicked on landmark
                    var landmarkSymbol = intersectsWithLms[0].object;
                    // hunt through the landmarkViews for the right symbol
                    for (var i = 0; i < that.landmarkViews.length; i++) {
                        if (that.landmarkViews[i].symbol === landmarkSymbol) {
                            lmPressed = that.landmarkViews[i].model;
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
                    positionLmDrag.copy(
                        that.worldToScreen(
                            that.s_meshAndLms.localToWorld(
                                lmPressed.point().clone())));
                    // start listening for dragging landmarks
                    $(document).on('mousemove.landmarkDrag', landmarkOnDrag);
                    $(document).one(
                        'mouseup.viewportLandmark', landmarkOnMouseUp);
                }

                function nothingPressed() {
                    console.log('nothing pressed!');
                    $(document).one(
                        'mouseup.viewportNothing', nothingOnMouseUp);
                }

                function shiftPressed() {
                    console.log('shift pressed!');
                    // before anything else, disable the camera
                    that.cameraController.disable();
                    $(document).on('mousemove.shiftDrag', shiftOnDrag);
                    $(document).one('mouseup.viewportShift', shiftOnMouseUp);
                }
            });

            var landmarkOnDrag = atomic.atomicOperation(function(event) {
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
                var selectedLandmarks = that.model.landmarks().selected();
                var lm, vScreen;
                for (var i = 0; i < selectedLandmarks.length; i++) {
                    lm = selectedLandmarks[i];
                    // convert to screen coordinates
                    vScreen = that.worldToScreen(that.s_meshAndLms.localToWorld(
                        lm.point().clone()));

                    // budge the screen coordinate
                    vScreen.add(deltaLmDrag);

                    // use the standard machinery to find intersections
                    // note that we intersect the mesh to use the octree
                    intersectsWithMesh = that.getIntersects(vScreen.x,
                        vScreen.y, that.mesh);
                    if (intersectsWithMesh.length > 0) {
                        // good, we're still on the mesh.
                        lm.setPoint(that.s_meshAndLms.worldToLocal(
                            intersectsWithMesh[0].point.clone()));
                    } else {
                        // don't update point - it would fall off the surface.
                        console.log("fallen off mesh");
                    }
                }
            });

            var shiftOnDrag = function (event) {
                console.log("shift:drag");
                // note - we use client as we don't want to jump back to zero
                // if user drags into sidebar!
                var newX = event.clientX;
                var newY = event.clientY;
                // clear the canvas and draw a selection rect.
                that.clearCanvas();
                var x = onMouseDownPosition.x;
                var y = onMouseDownPosition.y;
                var dx = newX - x;
                var dy = newY - y;
                that.ctx.strokeRect(x, y, dx, dy);
            };

            var shiftOnMouseUp = atomic.atomicOperation(function (event) {
                that.cameraController.enable();
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
                var lms = that.lmViewsInSelectionBox(min_x, min_y,
                                                     max_x, max_y);

                // Of these, filter out the ones which are visible (not
                // obscured)
                var visibleLms = [];
                _.each(lms, function(lm) {
                    if (that.lmViewVisible(lm)) {
                        visibleLms.push(lm);
                    }
                });

                _.each(visibleLms, function (lm) {
                    lm.model.select();
                });

                that.clearCanvas();
                that.isPressed = false;
            });

            var meshOnMouseUp = function (event) {
                console.log("meshPress:up");
                var p;
                onMouseUpPosition.set(event.clientX, event.clientY);
                if (onMouseDownPosition.distanceTo(onMouseUpPosition) < 2) {
                    //  a click on the mesh
                    p = intersectsWithMesh[0].point.clone();
                    // Convert the point back into the mesh space
                    that.s_meshAndLms.worldToLocal(p);
                    that.model.landmarks().insertNew(p);
                }

                that.isPressed = false;
            };

            var nothingOnMouseUp = function (event) {
                console.log("nothingPress:up");
                onMouseUpPosition.set(event.clientX, event.clientY);
                if (onMouseDownPosition.distanceTo(onMouseUpPosition) < 2) {
                    // a click on nothing - deselect all
                    that.model.landmarks().deselectAll();
                }

                that.isPressed = false;
            };

            var landmarkOnMouseUp = atomic.atomicOperation(function (event) {
                var ctrl = downEvent.ctrlKey || downEvent.metaKey;
                that.cameraController.enable();
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

                that.isPressed = false;
            });
            return onMouseDown
        })();

        this.moveHandler = (() => {

            var _selectedLm;

            var _handler = (evt) => {

                this.clearCanvas();

                if (this.isPressed || !this.model.isEditingOn()) {
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

                // Only fetch closests if not ctrl locked or non existant
                if (!evt.ctrlKey || _selectedLm === undefined) {
                    var minDist, dist, i,
                        lm, lmLoc, closest,
                        mouseLoc = this.s_meshAndLms.worldToLocal(
                            intersectsWithMesh[0].point.clone());

                    for (i = lmGroup.landmarks.length - 1; i >= 0; i--) {
                        lm = lmGroup.landmarks[i];
                        lmLoc = lm.point();
                        if (lmLoc !== null) {
                            dist = mouseLoc.distanceTo(lmLoc);
                            if (!minDist || dist < minDist) {
                                [minDist, closest] = [dist, lm];
                            }
                        }
                    }
                }

                if (closest) { // If we set closests in this handling
                    _selectedLm = closest;
                }

                if (_selectedLm) { // Always happens while we have _selectedLm

                    _selectedLm.selectAndDeselectRest();
                    _selectedLm.setNextAvailable();

                    this.drawTargetingLine(
                        {x: evt.clientX, y: evt.clientY},
                        this.worldToScreen(
                            this.s_meshAndLms.localToWorld(
                                _selectedLm.point().clone())));
                }
            }

            // Throttle for performance, tradeoff with realtiminess of the
            // feedback loop
            return _.throttle(_handler, 50);
        })();

        // ----- BIND HANDLERS ----- //
        window.addEventListener('resize', this.resize, false);
        this.listenTo(this.model, "newMeshAvailable", this.changeMesh);
        this.listenTo(this.model, "change:landmarks", this.changeLandmarks);

        this.showConnectivity = true;
        this.listenTo(
            this.model,
            "change:connectivityOn",
            this.updateConnectivityDisplay
        );
        this.updateConnectivityDisplay();

        this.listenTo(
            this.model, "change:editingOn", this.updateEditingDisplay);
        this.updateEditingDisplay();

        this.listenTo(atomic, "change:ATOMIC_OPERATION", this.batchHandler);

        // trigger resize to initially size the viewport
        // this will also clearCanvas (will draw context box if needed)
        this.resize();

        // register for the animation loop
        animate();

        function animate() {
            requestAnimationFrame(animate);
            // uncomment to monitor FPS performance
            //stats.update();
        }
    },

    drawTargetingLine: function (start, end) {
        this.ctx.strokeStyle = "#2cfdfe";
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();
    },

    toggleCamera: function () {
        // check what the current setting is
        var currentlyPerspective = (this.s_camera === this.s_pCam);
        if (currentlyPerspective) {
            // going to orthographic - start listening for pip updates
            this.listenTo(this.cameraController, "changePip", this.update);
            this.s_camera = this.s_oCam;
        } else {
            // leaving orthographic - stop listening to pip calls.
            this.stopListening(this.cameraController, "changePip");
            this.s_camera = this.s_pCam;
        }
        // clear the canvas to make
        this.clearCanvas();
        this.update();
    },

    // ----- EVENTS ----- //
    // General function for finding intersections from a mouse click event
    // to some group of objects in s_scene.
    getIntersects: function (x, y, object) {
        if (object === null || object.length === 0) {
            return [];
        }
        var vector = new THREE.Vector3((x / this.$container.width()) * 2 - 1,
                                        -(y / this.$container.height()) * 2 + 1, 0.5);

        if (this.s_camera === this.s_pCam) {
            // perspective selection
            vector.setZ(0.5);
            vector.unproject(this.s_camera);
            this.ray.set(this.s_camera.position, vector.sub(this.s_camera.position).normalize());
        } else {
            // orthographic selection
            vector.setZ(-1);
            vector.unproject(this.s_camera);
            var dir = new THREE.Vector3(0, 0, - 1).transformDirection(this.s_camera.matrixWorld);
            this.ray.set(vector, dir);
        }

        if (object === this.mesh && this.octree) {
            // we can use the octree to intersect the mesh efficiently.
            return octree.intersetMesh(this.ray, this.mesh, this.octree);
        } else if (object instanceof Array) {
            return this.ray.intersectObjects(object, true);
        } else {
            return this.ray.intersectObject(object, true);
        }
    },

    getIntersectsFromEvent: function (event, object) {
      return this.getIntersects(event.clientX, event.clientY, object);
    },

    worldToScreen: function (vector) {
        var widthHalf = this.$container.width() / 2;
        var heightHalf = this.$container.height() / 2;
        var result = vector.project(this.s_camera);
        result.x = (result.x * widthHalf) + widthHalf;
        result.y = -(result.y * heightHalf) + heightHalf;
        return result;
    },

    lmToScreen: function (lmSymbol) {
        var pos = lmSymbol.position.clone();
        this.s_meshAndLms.localToWorld(pos);
        return this.worldToScreen(pos);
    },

    lmViewsInSelectionBox: function (x1, y1, x2, y2) {
        var c;
        var lmsInBox = [];
        var that = this;
        _.each(this.landmarkViews, function (lmView) {
            if (lmView.symbol) {
                c = that.lmToScreen(lmView.symbol);
                if (c.x > x1 && c.x < x2 && c.y > y1 && c.y < y2) {
                    lmsInBox.push(lmView);
                }
            }

        });
        return lmsInBox;
    },

    lmViewVisible: function (lmView) {
        if (!lmView.symbol) {
            return false;
        }
        var screenCoords = this.lmToScreen(lmView.symbol);
        // intersect the mesh and the landmarks
        var iMesh = this.getIntersects(
            screenCoords.x, screenCoords.y, this.mesh);
        var iLm = this.getIntersects(
            screenCoords.x, screenCoords.y, lmView.symbol);
        // is there no mesh here (pretty rare as landmarks have to be on mesh)
        // or is the mesh behind the landmarks?
        return iMesh.length == 0 || iMesh[0].distance > iLm[0].distance;
    },

    events: {
        'mousedown' : "mousedownHandler",
    },

    mousedownHandler: function (event) {
        event.preventDefault();
        // delegate to the handler closure
        this.handler(event);
    },

    updateConnectivityDisplay: atomic.atomicOperation(function () {
        this.showConnectivity = this.model.isConnectivityOn();
    }),

    updateEditingDisplay: atomic.atomicOperation(function () {
        this.editingOn = this.model.isEditingOn();
        // Manually bind to avoid useless function call (even with no effect)
        if (this.editingOn) {
            this.$el.on('mousemove', this.moveHandler);
        } else {
            this.$el.off('mousemove', this.moveHandler);
        }
    }),

    changeMesh: function () {
        var meshPayload, mesh, up, front;
        console.log('Viewport:changeMesh - memory before: ' +  this.memoryString());
        // firstly, remove any existing mesh
        this.removeMeshIfPresent();

        meshPayload = this.model.mesh();
        if (meshPayload === null) {
            return;
        }
        mesh = meshPayload.mesh;
        up = meshPayload.up;
        front = meshPayload.front;
        this.mesh = mesh;

        if(mesh.geometry instanceof THREE.BufferGeometry) {
            // octree only makes sense if we are dealing with a true mesh
            // (not images). Such meshes are always BufferGeometry instances.
            this.octree = octree.octreeForBufferGeometry(mesh.geometry);
        }

        this.s_mesh.add(mesh);
        // Now we need to rescale the s_meshAndLms to fit in the unit sphere
        // First, the scale
        this.meshScale = mesh.geometry.boundingSphere.radius;
        var s = 1.0 / this.meshScale;
        this.s_scaleRotate.scale.set(s, s, s);
        this.s_h_scaleRotate.scale.set(s, s, s);
        this.s_scaleRotate.up.copy(up);
        this.s_h_scaleRotate.up.copy(up);
        this.s_scaleRotate.lookAt(front.clone());
        this.s_h_scaleRotate.lookAt(front.clone());
        // translation
        var t = mesh.geometry.boundingSphere.center.clone();
        t.multiplyScalar(-1.0);
        this.s_translate.position.copy(t);
        this.s_h_translate.position.copy(t);
        this.update();
    },

    removeMeshIfPresent: function () {
        if (this.mesh !== null) {
            this.s_mesh.remove(this.mesh);
            this.mesh = null;
            this.octree = null;
        }
    },

    memoryString: function () {
        return  'geo:' + this.renderer.info.memory.geometries +
                ' tex:' + this.renderer.info.memory.textures +
                ' prog:' + this.renderer.info.memory.programs;
    },

    changeLandmarks: atomic.atomicOperation(function () {
        console.log('Viewport: landmarks have changed');
        var that = this;

        // 1. Dispose of all landmark and connectivity views
        _.map(this.landmarkViews, function (lmView) {
            lmView.dispose();
        });
        _.map(this.connectivityViews, function (connView) {
            connView.dispose();
        });

        // 2. Build a fresh set of views - clear any existing views
        this.landmarkViews = [];
        this.connectivityViews = [];

        var landmarks = this.model.get('landmarks');
        if (landmarks === null) {
            // no actual landmarks available - return
            // TODO when can this happen?!
            return;
        }
        landmarks.landmarks.map(function (lm) {
            that.landmarkViews.push(new LandmarkTHREEView(
                {
                    model: lm,
                    viewport: that
                }));
        });
        landmarks.connectivity.map(function (a_to_b) {
           that.connectivityViews.push(new LandmarkConnectionTHREEView(
               {
                   model: [landmarks.landmarks[a_to_b[0]],
                           landmarks.landmarks[a_to_b[1]]],
                   viewport: that
               }));
        });

    }),

    // this is called whenever there is a state change on the THREE scene
    update: function () {
        if (!this.renderer) {
            return;
        }
        // if in batch mode - noop.
        if (atomic.atomicOperationUnderway()) {
            return;
        }
        //console.log('Viewport:update');
        // 1. Render the main viewport
        var w, h;
        w = this.$container.width();
        h = this.$container.height();
        this.renderer.setViewport(0, 0, w, h);
        this.renderer.setScissor(0, 0, w, h);
        this.renderer.enableScissorTest (true);
        this.renderer.clear();
        this.renderer.render(this.scene, this.s_camera);

        if (this.showConnectivity) {
            this.renderer.clearDepth(); // clear depth buffer
            // and render the connectivity
            this.renderer.render(this.sceneHelpers, this.s_camera);
        }

        // 2. Render the PIP image if in orthographic mode
        if (this.s_camera === this.s_oCam) {
            var minX, minY, pipW, pipH;
            var bounds = this.pilBounds();
            minX = bounds[0];
            minY = bounds[1];
            pipW = bounds[2];
            pipH = bounds[3];
            this.renderer.setClearColor(CLEAR_COLOUR_PIP, 1);
            this.renderer.setViewport(minX, minY, pipW, pipH);
            this.renderer.setScissor(minX, minY, pipW, pipH);
            this.renderer.enableScissorTest(true);
            this.renderer.clear();
            // render the PIP image
            this.renderer.render(this.scene, this.s_oCamZoom);
            if (this.showConnectivity) {
                this.renderer.clearDepth(); // clear depth buffer
                // and render the connectivity
                this.renderer.render(this.sceneHelpers, this.s_oCamZoom);
            }
            this.renderer.setClearColor(CLEAR_COLOUR, 1);
        }
    },

    pilBounds: function () {
        var w = this.$container.width();
        var h = this.$container.height();
        var maxX = w - PIP_MARGIN;
        var maxY = h - PIP_MARGIN;
        var minX = maxX - PIP_WIDTH;
        var minY = maxY - PIP_HEIGHT;
        return [minX, minY, PIP_WIDTH, PIP_HEIGHT];
    },

    resetCamera: function () {
        // reposition the cameras and focus back to the starting point.
        var v = this.model.meshMode() ? MESH_MODE_STARTING_POSITION : IMAGE_MODE_STARTING_POSITION;
        this.cameraController.position(v);
        this.cameraController.focus(this.scene.position);
        this.update();
    },

    clearCanvas: function () {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.strokeStyle = '#ffffff';
        if (this.s_camera === this.s_oCam) {
            // orthographic means there is the PIP window. Draw the box and
            // target.
            var b = this.pilBounds();
            var minX = b[0];
            var minY = this.canvas.height - b[1] - b[3];
            var width = b[2];
            var height = b[3];
            var maxX = minX + width;
            var maxY = minY + height;
            var midX = (2 * minX + width)/2;
            var midY = (2 * minY + height) / 2;
            // vertical line
            this.ctx.strokeRect(minX, minY, width, height);
            this.ctx.beginPath();
            this.ctx.moveTo(midX, minY);
            this.ctx.lineTo(midX, maxY);
            this.ctx.closePath();
            this.ctx.stroke();
            // horizontal line
            this.ctx.beginPath();
            this.ctx.moveTo(minX, midY);
            this.ctx.lineTo(maxX, midY);
            this.ctx.closePath();
            this.ctx.stroke();
        }
    },

    resize: function () {
        var w, h;
        w = this.$container.width();
        h = this.$container.height();
        // ask the camera controller to update the cameras appropriately
        this.cameraController.resize(w, h);
        // update the size of the renderer and the canvas
        this.renderer.setSize(w, h);
        this.canvas.width = w;
        this.canvas.height = h;
        // clear the canvas to make sure the PIP box is correct
        this.clearCanvas();
        this.update();
    },

    batchHandler: function (dispatcher) {
        if (dispatcher.atomicOperationFinished()) {
            // just been turned off - trigger an update.
            this.update();
        }
    }
});
