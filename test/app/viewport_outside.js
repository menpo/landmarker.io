// @vitest-environment jsdom
import { assert } from 'chai';
import { describe, it } from 'vitest';
import * as THREE from 'three';

import Viewport from '../../src/js/app/view/viewport/index';

// An image of 100 rows by 200 columns seen from the front by an orthographic camera that shows
// x from -50 to 150 (across the window) and y from -50 to 250 (up it): the window is 400 by 600, so 2 pixels per unit
function fakeViewport (keepInside = false) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
    mesh.geometry = new THREE.Geometry();
    [[0, 0], [100, 0], [100, 200], [0, 200]].forEach(([x, y]) =>
        mesh.geometry.vertices.push(new THREE.Vector3(x, y, 0)));
    mesh.geometry.computeBoundingBox();
    const sMeshAndLms = new THREE.Object3D();
    const camera = new THREE.OrthographicCamera(-50, 150, 250, -50, 0, 20);
    camera.position.set(0, 0, 10);
    camera.updateMatrixWorld(true);
    sMeshAndLms.updateMatrixWorld(true);
    return Object.assign(Object.create(Viewport.prototype), {
        mesh, sMeshAndLms, sCamera: camera, sPCam: new THREE.PerspectiveCamera(),
        ray: new THREE.Raycaster(), octree: null,
        model: {imageMode: () => true, isKeepInsideOn: () => keepInside},
        width: () => 400, height: () => 600
    });
}

const local = (viewport, x, y) => {
    const [hit] = viewport.getIntersects(x, y, viewport.mesh);
    return hit && viewport.worldToLocal(hit.point);
};

describe('where on an image a landmark can be put', function () {
    it('is anywhere on its plane, also past the edge of the picture', function () {
        const v = fakeViewport();
        // the middle of the window is (x, y) = (50, 100): inside the picture
        const inside = local(v, 200, 300);
        assert.closeTo(inside.x, 50, 1e-6);
        assert.closeTo(inside.y, 100, 1e-6);
        // near the top right corner of the window, past the picture on both sides
        const outside = local(v, 395, 5);
        assert.isTrue(outside.x > 100 || outside.x < 0 || outside.y > 200 || outside.y < 0,
                      `(${outside.x}, ${outside.y}) should be outside the picture`);
    });

    it('is clamped to the picture with keep inside on', function () {
        const v = fakeViewport(true);
        const outside = local(v, 395, 5);
        assert.isAtLeast(outside.x, 0);
        assert.isAtMost(outside.x, 100);
        assert.isAtLeast(outside.y, 0);
        assert.isAtMost(outside.y, 200);
        // a point that is inside is not moved
        const inside = local(v, 200, 300);
        assert.closeTo(inside.x, 50, 1e-6);
    });

    it('has a distance, as a hit with a mesh has', function () {
        const [hit] = (() => { const v = fakeViewport(); return v.getIntersects(200, 300, v.mesh); })();
        assert.isNumber(hit.distance);
    });
});
