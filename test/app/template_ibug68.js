import { assert } from 'chai';
import { describe, it } from 'vitest';

import ibug68 from '../../src/js/app/template/ibug68';

// The 68 points of ibug68 (300-W) are numbered jaw 0-16, brows 17-26, nose 27-35,
// eyes 36-47 and mouth 48-67, so the groups must come in that order and size for the points
// that are placed to mean what a model, the server's template or another tool expects.
describe('the built-in ibug68 template', function () {
    const first = (label) => {
        let n = 0;
        for (const g of ibug68.groups) {
            if (g.label === label) { return n; }
            n += g.points;
        }
        throw new Error(`no group ${label}`);
    };

    it('has 68 points', function () {
        assert.equal(ibug68.groups.reduce((n, g) => n + g.points, 0), 68);
    });

    it('numbers the groups like 300-W', function () {
        assert.deepEqual(
            ['chin', 'leyebrow', 'reyebrow', 'nose', 'leye', 'reye', 'mouth'].map(first),
            [0, 17, 22, 27, 36, 42, 48]);
    });
});
