var $ = require('jquery');
var _ = require('underscore');
var Backbone = require('backbone');
var THREE = require('three');
var Camera = require('./camera');

"use strict";

// clear colour for both the main view and PictureInPicture
var CLEAR_COLOUR = 0xDDDDDD;
var CLEAR_COLOUR_PIP = 0xCCCCCC;

// the default scale for 1.0
var LM_SCALE = 0.005;

var MESH_MODE_STARTING_POSITION = new THREE.Vector3(1.68, 0.35, 3.0);
var IMAGE_MODE_STARTING_POSITION = new THREE.Vector3(0.0, 0.0, 1.0);


var PIP_WIDTH = 300;
var PIP_HEIGHT = 300;
var PIP_MARGIN = 0;

exports.Viewport = Backbone.View.extend({

    el: '#canvas',
    id: 'canvas',

    initialize: function () {

        // to debug window.viewport = this;


        // ----- CONFIGURATION ----- //
        this.meshScale = 1.0;  // The radius of the mesh's bounding sphere

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
        this.s_camera = this.s_pCam;
        if (!this.model.meshMode()) {
            // but for images, default to orthographic camera
            // (note that we use toggle to make sure the UI gets updated)
            this.toggleCamera();
        }

        // create the cameraController to look after all camera state.
        this.cameraController = Camera.CameraController(
            this.s_pCam, this.s_oCam, this.s_oCamZoom,
            this.el, this.model.imageMode());

        // when the camera updates, render
        this.cameraController.on("change", this.update);

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

        this.renderer = new THREE.WebGLRenderer({antialias: true,
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

        // add mesh if there already is one present (we have missed a
        // backbone callback to changeMesh() otherwise).
        if (this.model.has('mesh')) {
            this.changeMesh();
        }

        // make an empty list of landmark views
        this.landmarkViews = [];
        this.connectivityViews = [];

        var downEvent, lmPressed, lmPressedWasSelected;

        // Tools for moving betweens screen and world coordinates
        this.ray = new THREE.Raycaster();
        this.projector = new THREE.Projector();

        // ----- MOUSE HANDLER ----- //
        // There is quite a lot of finicky state in handling the mouse
        // interaction which is of no concern to the rest of the viewport.
        // We wrap all this complexity up in a closure so it can enjoy access
        // to the general viewport state without leaking it's state all over
        // the place.
        var that = this;
        this.handler = (function () {
        // x, y position of mouse on click states
        var onMouseDownPosition = new THREE.Vector2();
        var onMouseUpPosition = new THREE.Vector2();

        // current world position when in drag state
        var positionLmDrag = new THREE.Vector3();
        // vector difference in one time step
        var deltaLmDrag = new THREE.Vector3();

        // where we store the intersection plane. Note that it will not be
        // moved if in image mode, so we set it exactly as we want for images.
        // In mesh mode the position will be updated constantly.
        var intersectPlanePos = new THREE.Vector3(0, 0, 0);
        var intersectsWithLms, intersectsWithMesh,
            intersectSOnPlane;

        // ----- OBJECT PICKING  ----- //
        var intersectPlane = new THREE.Mesh(new THREE.PlaneGeometry(10, 10));
        intersectPlane.position.copy(intersectPlanePos);
        intersectPlane.lookAt(new THREE.Vector3(0, 0, 1));
        intersectPlane.visible = false;
        that.sceneHelpers.add(intersectPlane);


        // Catch all for mouse interaction. This is what is bound on the canvas
        // and delegates to various other mouse handlers once it figures out
        // what the user has done.
        var onMouseDown = function (event) {
            event.preventDefault();
            that.$el.focus();
            downEvent = event;
            onMouseDownPosition.set(event.clientX, event.clientY);

            // All interactions require intersections to distinguish
            intersectsWithLms = that.getIntersectsFromEvent(event, that.s_lms);
            intersectsWithMesh = that.getIntersectsFromEvent(event, that.s_mesh);
            if (event.button === 0) {  // left mouse button
                if (intersectsWithLms.length > 0 &&
                    intersectsWithMesh.length > 0) {
                    // degenerate case - which is closer?
                    if (intersectsWithLms[0].distance <
                        intersectsWithMesh[0].distance) {
                        landmarkPressed(event);
                    } else {
                        // the mesh was pressed. Check for shift first though.
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
                console.log('landmark pressed!');
                // before anything else, disable the camera
                that.cameraController.disable();
                // the clicked on landmark
                var landmarkSymbol = intersectsWithLms[0].object;
                var group;
                // hunt through the landmarkViews for the right symbol
                for (var i = 0; i < that.landmarkViews.length; i++) {
                    if (that.landmarkViews[i].symbol === landmarkSymbol) {
                        lmPressed = that.landmarkViews[i].model;
                        group = that.landmarkViews[i].group;
                    }
                }
                group.activate();
                lmPressedWasSelected = lmPressed.isSelected();
                if (!lmPressedWasSelected && !ctrl) {
                    // this lm wasn't pressed before and we aren't holding
                    // mutliselection down - deselect rest and select this
                    console.log("normal click on a unselected lm - deselecting rest and selecting me");
                    lmPressed.collection.deselectAll();
                    lmPressed.select();
                }
                if (ctrl && !lmPressedWasSelected) {
                    lmPressed.select();
                }

//                if (group.landmarks().nSelected() >= 1) {
//                    // This is a multiple selection -
//                }
//                if ((event.ctrlKey || event.metaKey)) {
//                    if(landmark.isSelected()) {
//                        landmark.deselect();
//                    } else {
//                        landmark.select();
//                    }
//                } else {
//                    landmark.collection.deselectAll();
//                    landmark.select();
//                }
                // record the position of where the drag started.
                positionLmDrag.copy(that.s_meshAndLms.localToWorld(
                    lmPressed.point().clone()));
                if (that.model.meshMode()) {
                    // in 3D mode, we need to change the intersection plane
                    // to be normal to the camera and budge it a little closer
                    intersectPlanePos.subVectors(that.s_camera.position,
                        positionLmDrag);
                    intersectPlanePos.divideScalar(10.0);
                    intersectPlanePos.add(positionLmDrag);
                    intersectPlane.position.copy(intersectPlanePos);
                    intersectPlane.lookAt(that.s_camera.position);
                    intersectPlane.updateMatrixWorld();
                }
                // start listening for dragging landmarks
                $(document).on('mousemove.landmarkDrag', landmarkOnDrag);
                $(document).one('mouseup.viewportLandmark', landmarkOnMouseUp);
            }

            function nothingPressed() {
                console.log('nothing pressed!');
                $(document).one('mouseup.viewportNothing', nothingOnMouseUp);
            }

            function shiftPressed() {
                console.log('shift pressed!');
                // before anything else, disable the camera
                that.cameraController.disable();
                $(document).on('mousemove.shiftDrag', shiftOnDrag);
                $(document).one('mouseup.viewportShift', shiftOnMouseUp);
            }
        };

        var landmarkOnDrag = function (event) {
            console.log("drag");
            intersectSOnPlane = that.getIntersectsFromEvent(event,
                intersectPlane);
            if (intersectSOnPlane.length > 0) {
                var intersectMeshSpace = intersectSOnPlane[0].point.clone();
                var prevIntersectInMeshSpace = positionLmDrag.clone();
                that.s_meshAndLms.worldToLocal(intersectMeshSpace);
                that.s_meshAndLms.worldToLocal(prevIntersectInMeshSpace);
                // change in this step in mesh space
                deltaLmDrag.subVectors(intersectMeshSpace, prevIntersectInMeshSpace);
                // update the position
                positionLmDrag.copy(intersectSOnPlane[0].point);
                var activeGroup = that.model.get('landmarks').get('groups').active();
                var selectedLandmarks = activeGroup.landmarks().selected();
                var lm, lmP;
                that.model.dispatcher().enableBatchRender();
                for (var i = 0; i < selectedLandmarks.length; i++) {
                    lm = selectedLandmarks[i];
                    lmP = lm.point().clone();
                    lmP.add(deltaLmDrag);
                    //if (!lm.get('isChanging')) lm.set('isChanging', true);
                    lm.setPoint(lmP);
                }
                that.model.dispatcher().disableBatchRender();
            }
        };

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

        var shiftOnMouseUp = function (event) {
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

            // Of these, filter out the ones which are visible (not obscured)
            var visibleLms = [];
            _.each(lms, function(lm) {
                if (that.lmViewVisible(lm)) {
                    visibleLms.push(lm);
                }
            });

            var labelToGroup = that.model.landmarks().groups().labelsToGroups();
            var labelToCount = {};
            var label;
            // build a count of each group label
            _.each(visibleLms, function(lmView) {
                label = lmView.model.get('group').get('label');
               if (!labelToCount.hasOwnProperty(label)) {
                   labelToCount[label] = 0;
               }
               labelToCount[label] += 1;
            });

            // find the highest count
            var maxCountLabel = _.reduce(labelToCount,
                function (maxCountLabel, count, label) {
                    if (count > maxCountLabel[0]) {
                        return [count, label];
                    } else {
                        return maxCountLabel;
                    }
                }, [0, '']);

            // and activate that group
            var  maxLabel = maxCountLabel[1];
            labelToGroup[maxLabel].activate();

            // we can safely select all the models that were visable (a no op
            // on non-active group landmarks)
            _.each(visibleLms, function (lm) {
                lm.model.select();
            });

            that.clearCanvas();
        };

        var meshOnMouseUp = function (event) {
            console.log("meshPress:up");
            var p;
            onMouseUpPosition.set(event.clientX, event.clientY);
            if (onMouseDownPosition.distanceTo(onMouseUpPosition) < 2) {
                //  a click on the mesh
                p = intersectsWithMesh[0].point.clone();
                // Convert the point back into the mesh space
                that.s_meshAndLms.worldToLocal(p);
                that.model.get('landmarks').insertNew(p);
            }
        };

        var nothingOnMouseUp = function (event) {
            console.log("nothingPress:up");
            onMouseUpPosition.set(event.clientX, event.clientY);
            if (onMouseDownPosition.distanceTo(onMouseUpPosition) < 2) {
                // a click on nothing - deselect all
                that.model.get('landmarks').get('groups').deselectAll();
            }
        };

        var landmarkOnMouseUp = function (event) {
            var ctrl = downEvent.ctrlKey || downEvent.metaKey;
            that.cameraController.enable();
            console.log("landmarkPress:up");
            $(document).off('mousemove.landmarkDrag');
            var lm;
            onMouseUpPosition.set(event.clientX, event.clientY);
            if (onMouseDownPosition.distanceTo(onMouseUpPosition) > 0) {
                // landmark was dragged
                var activeGroup = that.model.get('landmarks').get('groups').active();
                var selectedLandmarks = activeGroup.landmarks().selected();
                var vWorld, vScreen;
                for (var i = 0; i < selectedLandmarks.length; i++) {
                    lm = selectedLandmarks[i];
                    // convert to screen coordinates
                    vWorld = that.s_meshAndLms.localToWorld(lm.point().clone());
                    vScreen = that.worldToScreen(vWorld);
                    // use the standard machinery to find intersections
                    intersectsWithMesh = that.getIntersects(vScreen.x,
                        vScreen.y, that.s_mesh);
                    if (intersectsWithMesh.length > 0) {
                        // good, we're still on the mesh.
                        lm.setPoint(that.s_meshAndLms.worldToLocal(
                            intersectsWithMesh[0].point.clone()));
                        lm.set('isChanging', false);
                    } else {
                        console.log("fallen off mesh");
                        // TODO add back in history!
//                                for (i = 0; i < selectedLandmarks.length; i++) {
//                                    selectedLandmarks[i].rollbackModifications();
//                                }
                        // ok, we've fixed the mess. drop out of the loop
                        break;
                    }
                    // only here as all landmarks were successfully moved
                    //landmarkSet.snapshotGroup(); // snapshot the active group
                }
            } else {
                // landmark was pressed
                if (lmPressedWasSelected && ctrl) {
                    lmPressed.deselect();
                } else if (!ctrl) {
                    lmPressed.collection.deselectAll();
                    lmPressed.select();
                }
            }
        };
        return onMouseDown
        })();

        // ----- BIND HANDLERS ----- //
        window.addEventListener('resize', this.resize, false);
        this.listenTo(this.model, "change:mesh", this.changeMesh);
        this.listenTo(this.model, "change:landmarks", this.changeLandmarks);
        this.listenTo(this.model.dispatcher(), "change:BATCH_RENDER", this.batchHandler);

        // trigger resize to initially size the viewport
        // this will also clearCanvas (will draw context box if needed)

        this.resize();

        // register for the animation loop
        animate();

        function animate() {
            requestAnimationFrame(animate);
        }
    },

    toggleCamera: function () {
        // check what the current setting is
        var currentlyPerspective = (this.s_camera === this.s_pCam);
        var s = $('#sidebarSpacer');
        s.toggleClass('Sidebar-Spacer--ForPip', currentlyPerspective);
        if (currentlyPerspective) {
            this.s_camera = this.s_oCam;
        } else {
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
        var vector = new THREE.Vector3(
                (x / this.$container.width()) * 2 - 1,
                -(y / this.$container.height()) * 2 + 1, 0.5);

        if (this.s_camera === this.s_pCam) {
            // perspective selection
            this.projector.unprojectVector(vector, this.s_camera);
            this.ray.set(this.s_camera.position,
                vector.sub(this.s_camera.position).normalize());
        } else {
            // orthographic selection
            this.ray = this.projector.pickingRay(vector, this.s_camera);
        }

        if (object instanceof Array) {
            return this.ray.intersectObjects(object, true);
        }
        return this.ray.intersectObject(object, true);
    },

    getIntersectsFromEvent: function (event, object) {
      return this.getIntersects(event.clientX, event.clientY, object);
    },

    worldToScreen: function (vector) {
        var widthHalf = this.$container.width() / 2;
        var heightHalf = this.$container.height() / 2;
        var result = this.projector.projectVector(vector.clone(), this.s_camera);
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
        var i = this.getIntersects(screenCoords.x, screenCoords.y,
            [this.s_mesh, lmView.symbol]);
        // is the nearest intersection the one we want?
        return (i[0].object === lmView.symbol)
    },

    events: {
        'mousedown' : "mousedownHandler"
    },

    mousedownHandler: function (event) {
        event.preventDefault();
        // delegate to the handler closure
        this.handler(event);
    },

    changeMesh: function () {
        var mesh, up, front;
        console.log('Viewport:changeMesh');
        console.log('Viewport:changeMesh - memory before: ' +  this.memoryString());
        // firstly, remove any existing mesh
        if (this.s_mesh.children.length) {
            var previousMesh = this.s_mesh.children[0];
            this.s_mesh.remove(previousMesh);
        }
        mesh = this.model.get('mesh').mesh;
        up = this.model.get('mesh').up;
        front = this.model.get('mesh').front;

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
        console.log('Viewport:changeMesh - memory after:  ' +  this.memoryString());
        this.update();
    },

    memoryString : function () {
        return  'geo:' + this.renderer.info.memory.geometries +
                ' tex:' + this.renderer.info.memory.textures +
                ' prog:' + this.renderer.info.memory.programs;
    },

    changeLandmarks: function () {
        console.log('Viewport: landmarks have changed');
        var that = this;
        // 1. Dispose of all landmark and connectivity views
        _.map(this.landmarkViews, function (lmView) {
            lmView.dispose();
        });
        _.map(this.connectivityViews, function (connView) {
            connView.dispose();
        });
//        this.s_meshAndLms.remove(this.s_lms);
//        this.s_h_meshAndLms.remove(this.s_lmsconnectivity);
//        this.s_lms = new THREE.Object3D();
//        this.s_lmsconnectivity = new THREE.Object3D();
//        this.s_meshAndLms.add(this.s_lms);
//        this.s_h_meshAndLms.add(this.s_lmsconnectivity);
        // 2. Build a fresh set of views - clear any existing lms
        this.landmarkViews = [];
        this.connectivityViews = [];
        var lms = this.model.get('landmarks');
        if (lms === null) {
            // no landmarks set - pass
            return
        }
        var groups = this.model.get('landmarks').get('groups');
        groups.each(function (group) {
            group.get('landmarks').each(function (lm) {
                that.landmarkViews.push(new LandmarkTHREEView(
                    {
                        model: lm,
                        group: group,
                        viewport: that
                    }));
            });
            _.each(group.connectivity(), function (a_to_b) {
               that.connectivityViews.push(new LandmarkConnectionTHREEView(
                   {
                       model: [group.landmarks().at(a_to_b[0]),
                               group.landmarks().at(a_to_b[1])],
                       group: group,
                       viewport: that
                   }));
            });
        })
    },

    // this is called whenever there is a state change on the THREE scene
    update: function () {
        if (!this.renderer) {
            return;
        }
        // if in batch mode - noop.
        if (this.model.dispatcher().isBatchRenderEnabled()) {
            return;
        }
        // 1. Render the main viewport
        var w, h;
        w = this.$container.width();
        h = this.$container.height();
        this.renderer.setViewport(0, 0, w, h);
        this.renderer.setScissor(0, 0, w, h);
        this.renderer.enableScissorTest (true);
        this.renderer.clear();
        this.renderer.render(this.scene, this.s_camera);
        this.renderer.render(this.sceneHelpers, this.s_camera);

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
            // never render connectivity in the zoom view
            //this.renderer.render(this.sceneHelpers, this.s_oCamZoom);
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
        if (!dispatcher.isBatchRenderEnabled()) {
            // just been turned off - trigger an update.
            this.update();
        }
    }
});


var LandmarkTHREEView = Backbone.View.extend({

    initialize: function (options) {
        _.bindAll(this, 'render', 'changeLandmarkSize');
        this.listenTo(this.model, "change", this.render);
        this.group = options.group;
        this.viewport = options.viewport;
        this.app = this.viewport.model;
        this.listenTo(this.group, "change:active", this.render);
        this.listenTo(this.app, "change:landmarkSize", this.changeLandmarkSize);
        this.symbol = null; // a THREE object that represents this landmark.
        // null if the landmark isEmpty
        this.render();
    },

    render: function () {
        if (this.symbol) {
            // this landmark already has an allocated representation..
            if (this.model.isEmpty()) {
                // but it's been deleted.
                this.dispose();
            } else {
                // the lm may need updating. See what needs to be done
                this.updateSymbol();
            }
        } else {
            // there is no symbol yet
            if (!this.model.isEmpty()) {
                console.log('meshScale: ' + this.viewport.meshScale);
                console.log('LM_SCALE: ' + LM_SCALE);
                // and there should be! Make it and update it
                this.symbol = this.createSphere(this.model.get('point'),
                    this.viewport.meshScale * LM_SCALE, 1);
                this.updateSymbol();
                // trigger changeLandmarkSize to make sure sizing is correct
                this.changeLandmarkSize();
                // and add it to the scene
                this.viewport.s_lms.add(this.symbol);
            }
        }
        // tell our viewport to update
        this.viewport.update();
    },

    createSphere: function (v, radius, selected) {
        console.log('creating sphere of radius ' + radius);
        var wSegments = 10;
        var hSegments = 10;
        var geometry = new THREE.SphereGeometry(radius, wSegments, hSegments);
        var landmark = new THREE.Mesh(geometry, createDummyMaterial(selected));
        landmark.name = 'Sphere ' + landmark.id;
        landmark.position.copy(v);
        return landmark;
        function createDummyMaterial(selected) {
            var hexColor = 0xffff00;
            if (selected) {
                hexColor = 0xff75ff
            }
            return new THREE.MeshPhongMaterial({color: hexColor});
        }
    },

    updateSymbol: function () {
        this.symbol.position.copy(this.model.point());
        if (this.group.get('active') && this.model.isSelected()) {
            this.symbol.material.color.setHex(0xff75ff);
        } else {
            this.symbol.material.color.setHex(0xffff00);
        }
    },

    dispose: function () {
        if (this.symbol) {
            this.viewport.s_lms.remove(this.symbol);
            this.symbol.geometry.dispose();
            this.symbol.material.dispose();
            this.symbol = null;
        }
    },

    changeLandmarkSize: function () {
        if (this.symbol) {
            // have a symbol, and need to change it's size.
            var radius = this.app.get('landmarkSize');
            this.symbol.scale.x = radius;
            this.symbol.scale.y = radius;
            this.symbol.scale.z = radius;
            // tell our viewport to update
            this.viewport.update();
        }
    }
});

var lineMaterial = new THREE.LineBasicMaterial({
    color: 0x0000ff,
    linewidth: 3
});

var LandmarkConnectionTHREEView = Backbone.View.extend({

    initialize: function (options) {
        // Listen to both models for changes
        this.listenTo(this.model[0], "change", this.render);
        this.listenTo(this.model[1], "change", this.render);
        this.group = options.group;
        this.viewport = options.viewport;
        this.listenTo(this.group, "change:active", this.render);
        this.symbol = null; // a THREE object that represents this connection.
        // null if the landmark isEmpty
        this.render();
    },

    render: function () {
        if (this.symbol !== null) {
            // this landmark already has an allocated representation..
            if (this.model[0].isEmpty() || this.model[1].isEmpty()) {
                // but it's been deleted.
                this.dispose();

            } else {
                // the connection may need updating. See what needs to be done
                this.updateSymbol();
            }
        } else {
            // there is no symbol yet
            if (!this.model[0].isEmpty() && !this.model[1].isEmpty()) {
                // and there should be! Make it and update it
                this.symbol = this.createLine(this.model[0].get('point'),
                        this.model[1].get('point'));
                this.updateSymbol();
                // and add it to the scene
                this.viewport.s_lmsconnectivity.add(this.symbol);
            }
        }
        // tell our viewport to update
        this.viewport.update();
    },

    createLine: function (start, end) {
        var geometry = new THREE.Geometry();
        geometry.dynamic = true;
        geometry.vertices.push(start.clone());
        geometry.vertices.push(end.clone());
        return new THREE.Line(geometry, lineMaterial);
    },

    dispose: function () {
        if (this.symbol) {
            this.viewport.s_lmsconnectivity.remove(this.symbol);
            this.symbol.geometry.dispose();
            this.symbol = null;
        }
    },

    updateSymbol: function () {
        this.symbol.geometry.vertices[0].copy(this.model[0].point());
        this.symbol.geometry.vertices[1].copy(this.model[1].point());
        this.symbol.geometry.verticesNeedUpdate = true;
    }
});
