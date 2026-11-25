// @vitest-environment jsdom
import { assert } from 'chai';
import { describe, it } from 'vitest';
import $ from 'jquery';
import * as THREE from 'three';

import Viewport from '../../src/js/app/view/viewport/index';
import CameraController from '../../src/js/app/view/viewport/camera';

// a viewport that is one part of a page: 400 by 300 pixels, 100 from the left and 50 from the top
function placedElement () {
    const el = document.createElement('canvas');
    Object.defineProperty(el, 'offsetWidth', {value: 400});
    Object.defineProperty(el, 'offsetHeight', {value: 300});
    el.getBoundingClientRect = () => ({left: 100, top: 50, width: 400, height: 300});
    document.body.appendChild(el);
    return el;
}

describe('mouse positions in a viewport that is a part of a page', function () {
    it('are counted from its top left corner, not the page\'s', function () {
        const el = placedElement();
        const position = Viewport.prototype.eventPosition.call({el}, {clientX: 300, clientY: 200});
        assert.deepEqual(position, {x: 200, y: 150});
    });

    it('are what the zoom view follows: the middle of the element is the middle of the picture', function () {
        const el = placedElement();
        const oCam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0, 20);
        const oCamZoom = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 20);
        CameraController(new THREE.PerspectiveCamera(), oCam, oCamZoom, el, true);
        // the middle of the element, in the page's pixels
        $(el).trigger($.Event('mousemove', {clientX: 300, clientY: 200}));
        assert.closeTo((oCamZoom.left + oCamZoom.right) / 2, 0, 1e-9);
        assert.closeTo((oCamZoom.top + oCamZoom.bottom) / 2, 0, 1e-9);
        // its top left corner
        $(el).trigger($.Event('mousemove', {clientX: 100, clientY: 50}));
        assert.closeTo((oCamZoom.left + oCamZoom.right) / 2, -10, 1e-9);
        assert.closeTo((oCamZoom.top + oCamZoom.bottom) / 2, 10, 1e-9);
    });
});
