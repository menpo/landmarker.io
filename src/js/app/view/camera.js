/**
 * Controller for handling basic camera events on a Landmarker.
 *
 * A landmarker in general has complex state - what landmarks are selected,
 * what mesh is being used, lighting arrangements, and so on. The camera's
 * behavior however is simple - in response to certain mouse and touch
 * interactions, the camera is rotated, zoomed, and panned around some sort of
 * target. This class encapsulates this behavior.
 *
 * Takes a camera object as it's first parameter, and optionally a domElement to
 * attach to (if none provided, the document is used).
 *
 * Hooks up the following callbacks to the domElement:
 *
 * - focus(target)  // refocus the camera on a new target
 * - pan(vector)  // pan the camera along a certain vector
 * - zoom(vector)  // zoom the camera along a certain vector
 * - rotate(delta)  // rotate the camera around the target
 *
 * Note that other more complex behaviors (selecting and repositioning landmarks
 * for instance) can disable the Controller temporarily with the enabled
 * property.
 */
var $ = require('jquery');
// Doesn't seem to be helping us...
//require('jquery-mousewheel')($);
var _ = require('underscore');
var Backbone = require('backbone');
var THREE = require('three');

var MOUSE_WHEEL_SENSITIVITY = 0.5;
var ROTATION_SENSITIVITY = 0.005;
var PIP_ZOOM_FACTOR = 20.0;

"use strict";

exports.CameraController = function (pCam, oCam, oCamZoom, domElement, IMAGE_MODE) {

    var controller = {};
    _.extend(controller, Backbone.Events);
    var STATE = { NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2 };
    var state = STATE.NONE;  // the current state of the Camera

    // internals
    var enabled = false; // note that we will enable on creation below!
    var tvec = new THREE.Vector3();  // a temporary vector for efficient maths
    var tinput = new THREE.Vector3(); // temp vec used for

    var target = new THREE.Vector3();  // where the camera is looking
    var normalMatrix = new THREE.Matrix3();

    // mouse tracking variables
    var mouseDownPosition = new THREE.Vector2();
    var mousePrevPosition = new THREE.Vector2();

    // Mouses position when in the middle of a click operation.
    var mouseCurrentPosition = new THREE.Vector2();

    // Mouses position hovering over the surface
    var mouseHoverPosition = new THREE.Vector2();
    var mouseMouseDelta = new THREE.Vector2();

    function focus(newTarget) {
        // focus all cameras at a new target.
        target.copy(newTarget);
        pCam.lookAt(target);
        oCam.lookAt(target);
        oCamZoom.lookAt(target);
        //controller.trigger('change');
    }

    function position(v) {
        // position all cameras at a new location.
        pCam.position.copy(v);
        oCam.position.copy(v);
        oCamZoom.position.copy(v);
    }

    function pan(distance) {
        // first, handle the pCam...
        var oDist = distance.clone();
        normalMatrix.getNormalMatrix(pCam.matrix);
        distance.applyMatrix3(normalMatrix);
        distance.multiplyScalar(distanceToTarget() * 0.001);
        pCam.position.add(distance);
        // TODO should the target change as this?!
        target.add(distance);

        // second, the othoCam
        var o = mousePositionInOrthographicView(oDist);
        // relative x movement * otho width = how much to change horiz
        var deltaH = o.xR * o.width;
        oCam.left += deltaH;
        oCam.right += deltaH;
        // relative y movement * otho height = how much to change vert
        var deltaV = o.yR * o.height;
        oCam.top += deltaV;
        oCam.bottom += deltaV;
        oCam.updateProjectionMatrix();
        controller.trigger('change');
    }

    function zoom(distance) {
        var scalar = distance.z * 0.0007;
        // First, handling the perspective matrix
        normalMatrix.getNormalMatrix(pCam.matrix);
        distance.applyMatrix3(normalMatrix);
        distance.multiplyScalar(distanceToTarget() * 0.001);
        pCam.position.add(distance);

        // Then, the orthographic. In general, we are just going to squeeze in
        // the bounds of the orthographic frustum to zoom.
        if (oCam.right - oCam.left < 0.001 && scalar < 0) {
            // trying to zoom in and we are already tight. return.
            return
        }

        // Difference must respect aspect ratio, otherwise we will distort
        var a = ((oCam.top - oCam.bottom)) / (oCam.right - oCam.left);

        // find out where the mouse currently is in the view.
        var oM = mousePositionInOrthographicView(mouseHoverPosition);

        // overall difference in height scale is scalar * 2, but we weight
        // where this comes off based on mouse position
        oCam.left   -= (scalar * oM.xR) / (a);
        oCam.right  += (scalar * (1 - oM.xR)) / (a);
        oCam.top    += scalar * oM.yR;
        oCam.bottom -= scalar * (1 - oM.yR);
        if (oCam.left > oCam.right) {
            oCam.left = oCam.right - 0.0001;
        }
        if (oCam.bottom > oCam.top) {
            oCam.bottom = oCam.top - (0.0001 * a);
        }
        oCam.updateProjectionMatrix();
        // call the mouse hover callback manually, he will trigger a change
        // for us. Little nasty, but we mock the event...
        onMouseMoveHover({pageX: mouseHoverPosition.x,
                          pageY: mouseHoverPosition.y});
        //controller.trigger('change');
    }

    function distanceToTarget() {
        return tvec.subVectors(target, pCam.position).length();
    }

    function rotateCamera(delta, camera) {
        var theta, phi, radius;
        var EPS = 0.000001;

        // vector = position - target
        tvec.copy(camera.position).sub(target);
        radius = tvec.length();

        theta = Math.atan2(tvec.x, tvec.z);
        phi = Math.atan2(Math.sqrt(tvec.x * tvec.x + tvec.z * tvec.z),
            tvec.y);
        theta += delta.x;
        phi += delta.y;
        phi = Math.max(EPS, Math.min(Math.PI - EPS, phi));

        // update the vector for the new theta/phi/radius
        tvec.x = radius * Math.sin(phi) * Math.sin(theta);
        tvec.y = radius * Math.cos(phi);
        tvec.z = radius * Math.sin(phi) * Math.cos(theta);

        camera.position.copy(target).add(tvec);
        camera.lookAt(target);
    }

    function rotate(delta) {
        rotateCamera(delta, pCam);
        rotateCamera(delta, oCam);
        rotateCamera(delta, oCamZoom);
        controller.trigger('change');
    }

    // mouse
    function onMouseDown(event) {
        console.log('camera: mousedown');
        if (!enabled) return;
        event.preventDefault();
        mouseDownPosition.set(event.pageX, event.pageY);
        mousePrevPosition.copy(mouseDownPosition);
        mouseCurrentPosition.copy(mousePrevPosition);
        switch (event.button) {
            case 0:
                if (IMAGE_MODE) {
                    state = STATE.PAN;
                } else {
                    state = STATE.ROTATE;
                }
                break;
            case 1:
                state = STATE.ZOOM;
                break;
            case 2:
                state = STATE.PAN;
                break;
        }
        $(document).on('mousemove.camera', onMouseMove);
        // listen once for the mouse up
        $(document).one('mouseup.camera', onMouseUp);
    }

    function onMouseMove(event) {
        event.preventDefault();
        mouseCurrentPosition.set(event.pageX, event.pageY);
        mouseMouseDelta.subVectors(mouseCurrentPosition, mousePrevPosition);

        switch (state) {
            case STATE.ROTATE:
                tinput.copy(mouseMouseDelta);
                tinput.z = 0;
                tinput.multiplyScalar(-ROTATION_SENSITIVITY);
                rotate(tinput);
                break;
            case STATE.ZOOM:
                tinput.set(0, 0, mouseMouseDelta.y);
                zoom(tinput);
                break;
            case STATE.PAN:
                tinput.set(-mouseMouseDelta.x, mouseMouseDelta.y, 0);
                pan(tinput);
                break;
        }

        // now work has been done update the previous position
        mousePrevPosition.copy(mouseCurrentPosition);
    }

    function mousePositionInOrthographicView(v) {
        // convert into relative coordinates (0-1)
        var x = v.x / domElement.width;
        var y = v.y / domElement.height;
        // get the current height and width of the orthographic
        var oWidth = oCam.right - oCam.left;
        var oHeight = oCam.top - oCam.bottom;

        // so in this coordinate ortho matrix is focused around
        var oX = oCam.left + x * oWidth;
        var oY = oCam.bottom + (1 - y) * oHeight;

        return {
            x: oX,
            y: oY,
            xR: x,
            yR: y,
            width: oWidth,
            height: oHeight
        };
    }

    function onMouseMoveHover(event) {
        mouseHoverPosition.set(event.pageX, event.pageY);
        var oM = mousePositionInOrthographicView(mouseHoverPosition);

        // and new bounds are
        var zH = oM.height / PIP_ZOOM_FACTOR;
        // TODO this assumes square PIP image
        var zV = zH;
        // reconstructing bounds is easy...
        oCamZoom.left = oM.x - (zH/2);
        oCamZoom.right = oM.x + (zH/2);
        oCamZoom.top = oM.y + (zV/2);
        oCamZoom.bottom = oM.y - (zV/2);
        oCamZoom.updateProjectionMatrix();
        controller.trigger('change');
    }

    function onMouseUp(event) {
        console.log('camera: up');
        event.preventDefault();
        $(document).off('mousemove.camera');
        state = STATE.NONE;
    }

    function onMouseWheel(event) {
        //console.log('camera: mousewheel');
        if (!enabled) return;
        tinput.set(0, 0, (-event.originalEvent.deltaY * MOUSE_WHEEL_SENSITIVITY));
        zoom(tinput);
    }

    function disable() {
        console.log('camera: disable');
        enabled = false;
        $(domElement).off('mousedown.camera');
        $(domElement).off('wheel.camera');
        $(document).off('mousemove.camera');
    }

    function enable() {
        if (!enabled) {
            console.log('camera: enable');
            enabled = true;
            $(domElement).on('mousedown.camera', onMouseDown);
            $(domElement).on('wheel.camera', onMouseWheel);
        }
    }

//    // touch
//    var touch = new THREE.Vector3();
//    var prevTouch = new THREE.Vector3();
//    var prevDistance = null;
//
//    function touchStart(event) {
//        if (!enabled) return;
//        var touches = event.touches;
//        switch (touches.length) {
//            case 2:
//                var dx = touches[0].pageX - touches[1].pageX;
//                var dy = touches[0].pageY - touches[1].pageY;
//                prevDistance = Math.sqrt(dx * dx + dy * dy);
//                break;
//        }
//        prevTouch.set(touches[0].pageX, touches[0].pageY, 0);
//    }
//
//    function touchMove(event) {
//        if (!enabled) return;
//        event.preventDefault();
//        event.stopPropagation();
//        var touches = event.touches;
//        touch.set(touches[0].pageX, touches[0].pageY, 0);
//        switch (touches.length) {
//            case 1:
//                scope.rotate(touch.sub(prevTouch).multiplyScalar(-0.005));
//                break;
//            case 2:
//                var dx = touches[0].pageX - touches[1].pageX;
//                var dy = touches[0].pageY - touches[1].pageY;
//                var distance = Math.sqrt(dx * dx + dy * dy);
//                scope.zoom(new THREE.Vector3(0, 0, prevDistance - distance));
//                prevDistance = distance;
//                break;
//            case 3:
//                scope.pan(touch.sub(prevTouch).setX(-touch.x));
//                break;
//        }
//        prevTouch.set(touches[0].pageX, touches[0].pageY, 0);
//    }
//
//    // TODO renable touch
//    //domElement.addEventListener('touchstart', touchStart, false);
//    //domElement.addEventListener('touchmove', touchMove, false);

    // enable everything on creation
    enable();
    $(domElement).on('mousemove.pip', onMouseMoveHover);

    function resize (w, h) {
        var aspect = w / h;

        // 1. Update the orthographic camera
        if (aspect > 1) {
            // w > h
            oCam.left = -aspect;
            oCam.right = aspect;
            oCam.top = 1;
            oCam.bottom = -1;
        } else {
            // h > w
            oCam.left = -1;
            oCam.right = 1;
            oCam.top = 1 / aspect;
            oCam.bottom = -1 / aspect;
        }
        oCam.updateProjectionMatrix();

        // 2. Update the perceptive camera
        pCam.aspect = aspect;
        pCam.updateProjectionMatrix();
    }

    controller.enable = enable;
    controller.disable = disable;
    controller.resize = resize;
    controller.focus = focus;
    controller.position = position;

    return controller;
};
