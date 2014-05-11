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
require('jquery-mousewheel')($);
var _ = require('underscore');
var Backbone = require('backbone');
var THREE = require('three');

var MOUSE_WHEEL_SENSITIVITY = 0.5;
var ROTATION_SENSITIVITY = 0.005;

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
    var mouseCurrentPosition = new THREE.Vector2();
    var mouseMouseDelta = new THREE.Vector2();

    function focus(newTarget) {
        target.copy(newTarget);
        pCam.lookAt(target);
        controller.trigger('change');
    }

    function pan(distance) {
        normalMatrix.getNormalMatrix(pCam.matrix);
        distance.applyMatrix3(normalMatrix);
        distance.multiplyScalar(distanceToTarget() * 0.001);
        pCam.position.add(distance);
        target.add(distance);
        controller.trigger('change');
    }

    function zoom(distance) {
        var scalar = distance.z * 0.0007;
        // First, handling the perspective matrix
        normalMatrix.getNormalMatrix(pCam.matrix);
        distance.applyMatrix3(normalMatrix);
        console.log("camera: zoom - dist: " + distance +
            "tgt: " + distanceToTarget());
        distance.multiplyScalar(distanceToTarget() * 0.001);
        pCam.position.add(distance);

        // Then, the orthographic
        var a = ((oCam.top - oCam.bottom)) / (oCam.right - oCam.left);
        // And then the orthographic one
        oCam.left   -= (scalar) / (a);
        oCam.right  += (scalar) / (a);
        oCam.top    += scalar;
        oCam.bottom -= scalar;
        oCam.updateProjectionMatrix();
        controller.trigger('change');
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

    function onMouseUp(event) {
        console.log('camera: up');
        event.preventDefault();
        $(document).off('mousemove.camera');
        state = STATE.NONE;
    }

    function onMouseWheel(event) {
        console.log('camera: mousewheel');
        if (!enabled) return;
        tinput.set(0, 0, (-event.deltaY * MOUSE_WHEEL_SENSITIVITY));
        console.log('wheel: ' + event.deltaY);
        zoom(tinput);
    }

    function disable() {
        console.log('camera: disable');
        enabled = false;
        $(domElement).off('mousedown.camera');
        $(domElement).off('mousewheel.camera');
        $(document).off('mousemove.camera');
    }

    function enable() {
        if (!enabled) {
            console.log('camera: enable');
            enabled = true;
            $(domElement).on('mousedown.camera', onMouseDown);
            $(domElement).on('mousewheel.camera', onMouseWheel);
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

    return controller;
};
