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
'use strict';

import _ from 'underscore';
import THREE from 'three';
import $ from 'jquery';
import Backbone from 'backbone';

const MOUSE_WHEEL_SENSITIVITY = 0.5;
const ROTATION_SENSITIVITY = 3.5;
const DAMPING_FACTOR = 0.2;
const PIP_ZOOM_FACTOR = 12.0;
// const EPS = 0.000001;

// see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent.deltaMode
const UNITS_FOR_MOUSE_WHEEL_DELTA_MODE = {
    0: 1.0, // The delta values are specified in pixels.
    1: 34.0, // The delta values are specified in lines.
    2: 1.0 // The delta values are specified in pages.
};

export default function CameraController (pCam, oCam, oCamZoom, domElement) {

    const controller = {};
    _.extend(controller, Backbone.Events);

    const STATE = {
        NONE: -1,
        ROTATE: 0,
        ZOOM: 1,
        PAN: 2
    };

    let state = STATE.NONE; // the current state of the Camera
    let canRotate = true;
    let enabled = false; // note that we will enable on creation below!

    const target = new THREE.Vector3(); // where the camera is looking

    const origin = {
        target: target.clone(),
        pCamPosition: pCam.position.clone(),
        pCamUp: pCam.up.clone(),
        oCamPosition: oCam.position.clone(),
        oCamUp: oCam.up.clone(),
        oCamZoomPosition: oCamZoom.position.clone()
    };

    let height = 0, width = 0;

    function focus (newTarget) {
        // focus all cameras at a new target.
        target.copy(newTarget || origin.target);
        pCam.lookAt(target);
        oCam.lookAt(target);
        oCamZoom.lookAt(target);
    }

    function reset (newPosition, newTarget, newCanRotate) {
        state = STATE.NONE;
        allowRotation(newCanRotate);
        position(newPosition);
        pCam.up.copy(origin.pCamUp);
        oCam.up.copy(origin.oCamUp);
        focus(newTarget);
    }

    function position (v) {
        // position all cameras at a new location.
        pCam.position.copy(v || origin.pCamPosition);
        oCam.position.copy(v || origin.oCamPosition);
        oCamZoom.position.copy(v || origin.oCamZoomPosition);
    }

    function allowRotation (allowed=true) {
        canRotate = allowed;
    }

    function disable () {
        console.log('camera: disable');
        enabled = false;
        $(domElement).off('mousedown.camera');
        $(domElement).off('wheel.camera');
        $(document).off('mousemove.camera');
    }

    function enable () {
        if (!enabled) {
            console.log('camera: enable');
            enabled = true;
            $(domElement).on('mousedown.camera', onMouseDown);
            $(domElement).on('wheel.camera', onMouseWheel);
        }
    }

    function resize (w, h) {
        const aspect = w / h;
        height = h;
        width = w;

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

    const tvec = new THREE.Vector3(); // a temporary vector for efficient maths
    const tinput = new THREE.Vector3(); // temp vec used for

    const normalMatrix = new THREE.Matrix3();

    // mouse tracking variables
    const mouseDownPosition = new THREE.Vector2();
    const mousePrevPosition = new THREE.Vector2();

    // Mouses position when in the middle of a click operation.
    const mouseCurrentPosition = new THREE.Vector2();

    // Mouses position hovering over the surface
    const mouseHoverPosition = new THREE.Vector2();
    const mouseMoveDelta = new THREE.Vector2();

    function pan (distance) {
        // first, handle the pCam...
        const oDist = distance.clone();
        normalMatrix.getNormalMatrix(pCam.matrix);
        distance.applyMatrix3(normalMatrix);
        distance.multiplyScalar(distanceToTarget() * 0.001);
        pCam.position.add(distance);
        // TODO should the target change as this?!
        target.add(distance);

        // second, the othoCam
        const o = mousePositionInOrthographicView(oDist);
        // relative x movement * otho width = how much to change horiz
        const deltaH = o.xR * o.width;
        oCam.left += deltaH;
        oCam.right += deltaH;
        // relative y movement * otho height = how much to change vert
        const deltaV = o.yR * o.height;
        oCam.top += deltaV;
        oCam.bottom += deltaV;
        oCam.updateProjectionMatrix();
        controller.trigger('change');
    }

    function zoom (distance) {
        const scalar = distance.z * 0.0007;
        // First, handling the perspective matrix
        normalMatrix.getNormalMatrix(pCam.matrix);
        distance.applyMatrix3(normalMatrix);
        distance.multiplyScalar(distanceToTarget() * 0.001);
        pCam.position.add(distance);

        // Then, the orthographic. In general, we are just going to squeeze in
        // the bounds of the orthographic frustum to zoom.
        if (oCam.right - oCam.left < 0.001 && scalar < 0) {
            // trying to zoom in and we are already tight. return.
            return;
        }

        // Difference must respect aspect ratio, otherwise we will distort
        const a = ((oCam.top - oCam.bottom)) / (oCam.right - oCam.left);

        // find out where the mouse currently is in the view.
        const oM = mousePositionInOrthographicView(mouseHoverPosition);

        // overall difference in height scale is scalar * 2, but we weight
        // where this comes off based on mouse position
        oCam.left -= (scalar * oM.xR) / (a);
        oCam.right += (scalar * (1 - oM.xR)) / (a);
        oCam.top += scalar * oM.yR;
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
        onMouseMoveHover({
            pageX: mouseHoverPosition.x,
            pageY: mouseHoverPosition.y
        });
        controller.trigger('change');
    }

    function distanceToTarget () {
        return tvec.subVectors(target, pCam.position).length();
    }

    const pVec = new THREE.Vector3();
    // const sVec = new THREE.Vector3();

    function projectMouseOnSphere (px, py) {
        pVec.set(
            (px - width / 2) / (width / 2),
            (height - 2 * py) / screen.width,
            0
        );

        return pVec;
    }

    // function projectMouseOnScreen (px, py) {
    //
    // }

    // Rotation specific values
    let lastAngle, angle;
    const lastAxis = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const targetDirection = new THREE.Vector3();
    const axis = new THREE.Vector3();
    const upDirection = new THREE.Vector3();
    const sidewaysDirection = new THREE.Vector3();
    const moveDirection = new THREE.Vector3();

    function rotateCamera (delta, camera, singleDir=false) {

        let _delta;
        if (singleDir) {
            if (Math.abs(delta.x) >= Math.abs(delta.y)) {
                _delta = new THREE.Vector3(delta.x, 0, 0);
            } else {
                _delta = new THREE.Vector3(0, delta.y, 0);
            }
        } else {
            _delta = delta;
        }

        angle = _delta.length();
        tvec.copy(camera.position).sub(target);

        if (angle) {

            targetDirection.copy(tvec).normalize();

            upDirection.copy(camera.up).normalize();
            sidewaysDirection.crossVectors(upDirection, targetDirection)
                             .normalize();

            upDirection.setLength(_delta.y);
            sidewaysDirection.setLength(_delta.x);

            moveDirection.copy(upDirection.add(sidewaysDirection));
            axis.crossVectors(moveDirection, tvec).normalize();

            quaternion.setFromAxisAngle(axis, angle);
            tvec.applyQuaternion(quaternion);
            camera.up.applyQuaternion(quaternion);

            lastAxis.copy(axis);
            lastAngle = angle;
        } else if (lastAngle) {
            lastAngle *= Math.sqrt(1.0 - DAMPING_FACTOR);
            quaternion.setFromAxisAngle(lastAxis, lastAngle);
            tvec.applyQuaternion(quaternion);
            camera.up.applyQuaternion(quaternion);
        }

        camera.position.copy(target).add(tvec);
        camera.lookAt(target);
    }

    function rotate (delta, singleDir=false) {
        rotateCamera(delta, pCam, singleDir);
        rotateCamera(delta, oCam, singleDir);
        rotateCamera(delta, oCamZoom, singleDir);
        controller.trigger('change');
    }

    // mouse
    function onMouseDown (event) {
        console.log('camera: mousedown');
        if (!enabled) {
            return;
        }

        event.preventDefault();

        switch (event.button) {
            case 0:
                if (!canRotate) {
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

        if (state === STATE.ROTATE) {
            mouseDownPosition.copy(projectMouseOnSphere(event.pageX,
                                                        event.pageY));
        } else {
            mouseDownPosition.set(event.pageX, event.pageY);
        }

        mousePrevPosition.copy(mouseDownPosition);
        mouseCurrentPosition.copy(mousePrevPosition);

        $(document).on('mousemove.camera', onMouseMove);
        // listen once for the mouse up
        $(document).one('mouseup.camera', onMouseUp);
    }

    function onMouseMove (event) {

        event.preventDefault();

        if (state === STATE.ROTATE) {
            mouseCurrentPosition.copy(
                projectMouseOnSphere(event.pageX, event.pageY));
        } else {
            mouseCurrentPosition.set(event.pageX, event.pageY);
        }

        mouseMoveDelta.subVectors(mouseCurrentPosition, mousePrevPosition);

        switch (state) {
            case STATE.ROTATE:
                tinput.copy(mouseMoveDelta);
                tinput.z = 0;
                tinput.multiplyScalar(ROTATION_SENSITIVITY);
                rotate(tinput, event.ctrlKey);
                break;
            case STATE.ZOOM:
                tinput.set(0, 0, mouseMoveDelta.y);
                zoom(tinput);
                break;
            case STATE.PAN:
                tinput.set(-mouseMoveDelta.x, mouseMoveDelta.y, 0);
                pan(tinput);
                break;
        }

        mousePrevPosition.copy(mouseCurrentPosition);
    }

    function mousePositionInOrthographicView (v) {
        // convert into relative coordinates (0-1)
        var x = v.x / domElement.offsetWidth;
        var y = v.y / domElement.offsetHeight;
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

    function onMouseMoveHover (event) {
        mouseHoverPosition.set(event.pageX, event.pageY);
        var oM = mousePositionInOrthographicView(mouseHoverPosition);

        // and new bounds are
        var zH = oM.height / PIP_ZOOM_FACTOR;
        // TODO this assumes square PIP image
        var zV = zH;
        // reconstructing bounds is easy...
        const zHm = zH / 2,
            zVm = zV / 2;
        oCamZoom.left = oM.x - (zHm);
        oCamZoom.right = oM.x + (zHm);
        oCamZoom.top = oM.y + (zVm);
        oCamZoom.bottom = oM.y - (zVm);
        oCamZoom.updateProjectionMatrix();
        // emit a special change event. If the viewport is
        // interested (i.e. we are in PIP mode) it can update
        controller.trigger('changePip');
    }

    function onMouseUp (event) {
        console.log('camera: up');
        event.preventDefault();
        $(document).off('mousemove.camera');
        state = STATE.NONE;
    }

    function onMouseWheel (event) {
        //console.log('camera: mousewheel');
        if (!enabled) {
            return;
        }
        // we need to check the deltaMode to determine the scale of the mouse
        // wheel reading.
        var scale = UNITS_FOR_MOUSE_WHEEL_DELTA_MODE[event.originalEvent.deltaMode];
        tinput.set(0, 0, (-event.originalEvent.deltaY * MOUSE_WHEEL_SENSITIVITY * scale));
        zoom(tinput);
    }

    // touch
    const touch = new THREE.Vector3();
    const prevTouch = new THREE.Vector3();
    let prevDistance = null;

    function touchStart (event) {
        if (!enabled) {
            return;
        }
        const touches = event.touches;
        switch (touches.length) {
            case 2:
                var dx = touches[0].pageX - touches[1].pageX;
                var dy = touches[0].pageY - touches[1].pageY;
                prevDistance = Math.sqrt(dx * dx + dy * dy);
                break;
        }
        prevTouch.set(touches[0].pageX, touches[0].pageY, 0);
    }

    function touchMove (event) {
        if (!enabled) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        var touches = event.touches;
        touch.set(touches[0].pageX, touches[0].pageY, 0);
        switch (touches.length) {
            case 1:
                const delta = touch.sub(prevTouch).multiplyScalar(0.005);
                delta.setY(-1 * delta.y);
                rotate(delta);
                break;
            case 2:
                var dx = touches[0].pageX - touches[1].pageX;
                var dy = touches[0].pageY - touches[1].pageY;
                var distance = Math.sqrt(dx * dx + dy * dy);
                zoom(new THREE.Vector3(0, 0, prevDistance - distance));
                prevDistance = distance;
                break;
            case 3:
                pan(touch.sub(prevTouch).setX(-touch.x));
                break;
        }
        prevTouch.set(touches[0].pageX, touches[0].pageY, 0);
    }

    //TODO should this always be enabled?
    domElement.addEventListener('touchstart', touchStart, false);
    domElement.addEventListener('touchmove', touchMove, false);

    // enable everything on creation
    enable();
    $(domElement).on('mousemove.pip', onMouseMoveHover);

    controller.allowRotation = allowRotation;
    controller.enable = enable;
    controller.disable = disable;
    controller.resize = resize;
    controller.focus = focus;
    controller.position = position;
    controller.reset = reset;

    return controller;
}
