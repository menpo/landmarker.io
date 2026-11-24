// @vitest-environment jsdom
import { assert } from 'chai';
import { describe, it } from 'vitest';

import Viewport, { pipBoundsIn } from '../../src/js/app/view/viewport/index';

describe('the zoomed picture-in-picture view', function () {
    it('is in the top right corner, where the sidebar with the labels is not', function () {
        // three.js r94 counts the y of a viewport from the top of the window
        assert.deepEqual(pipBoundsIn(1920), {x: 1620, y: 0, width: 300, height: 300});
        assert.deepEqual(pipBoundsIn(800), {x: 500, y: 0, width: 300, height: 300});
    });

    it('is where the viewport says it is', function () {
        const bounds = Viewport.prototype.pipBounds.call({width: () => 1280, height: () => 700});
        assert.deepEqual(bounds, pipBoundsIn(1280));
    });
});
