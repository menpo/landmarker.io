import { readFileSync } from 'node:fs';
import { assert } from 'chai';
import { describe, it } from 'vitest';

import {
    curvesFromEdges, makeCurve, pointAt, resampleCurve, resampleCurves
} from '../../../src/js/app/lib/spline';

// values that menpo's CatmullRom computed (test/fixtures/spline_golden.json)
const golden = JSON.parse(readFileSync(
    new URL('../../fixtures/spline_golden.json', import.meta.url), 'utf8'));

const close = (actual, expected, tolerance = 1e-9, what = '') => {
    assert.equal(actual.length, expected.length, `${what}: lengths`);
    actual.forEach((row, i) => row.forEach((v, k) => {
        assert.isAtMost(Math.abs(v - expected[i][k]), tolerance,
                        `${what}: point ${i}, coordinate ${k}`);
    }));
};

describe('spline: the curve and its resampling are those of menpo', function () {
    golden.cases.forEach((c) => {
        it(c.name, function () {
            const curve = makeCurve(c.points, c.closed, c.alpha);
            assert.closeTo(curve.length, c.length, 1e-9);
            curve.arcPositions.forEach((s, i) => {
                assert.closeTo(s, c.arc_positions[i], 1e-9, `arc position ${i}`);
            });
            close(resampleCurve(curve, c.anchors, c.spacing), c.resampled, 1e-9, c.name);
        });
    });

    it('the curves of a graph, and the resampling of all of them', function () {
        const g = golden.graph;
        const curves = curvesFromEdges(g.edges, g.points.length);
        assert.deepEqual(curves, g.curves);
        const moved = resampleCurves(g.points, g.edges, g.anchors, g.spacing);
        close(moved, g.resampled, 1e-9, 'graph');
    });
});

describe('spline: the curve', function () {
    const line = [[0, 0], [1, 0], [2, 0], [10, 0]];

    it('goes through its points', function () {
        const curve = makeCurve(line);
        curve.arcPositions.forEach((s, i) => {
            const [x, y] = pointAt(curve, s);
            assert.closeTo(x, line[i][0], 1e-9);
            assert.closeTo(y, line[i][1], 1e-9);
        });
    });

    it('resamples a line to equal steps', function () {
        const moved = resampleCurve(makeCurve(line));
        [0, 10 / 3, 20 / 3, 10].forEach((x, i) => assert.closeTo(moved[i][0], x, 1e-9));
    });

    it('does not move anchors, and the ends are always anchors', function () {
        const points = [[0, 0], [1, 2], [3, 3], [6, 3], [7, 7], [9, 8]];
        const moved = resampleCurve(makeCurve(points), [3]);
        assert.deepEqual(moved[0], points[0]);
        assert.deepEqual(moved[3], points[3]);
        assert.deepEqual(moved[5], points[5]);
    });

    it('takes fractions of the arc between anchors', function () {
        const five = [0, 1, 2, 3, 4].map(x => [x, 0]);
        const moved = resampleCurve(makeCurve(five), [0, 4], {1: 0.1, 2: 0.2, 3: 0.9});
        [0, 0.4, 0.8, 3.6, 4].forEach((x, i) => assert.closeTo(moved[i][0], x, 1e-9));
    });

    it('refuses nonsense', function () {
        const five = [0, 1, 2, 3, 4].map(x => [x, 0]);
        const curve = makeCurve(five);
        assert.throws(() => makeCurve([[0, 0]]));
        assert.throws(() => makeCurve([[0, 0], [1, 1]], true));
        assert.throws(() => resampleCurve(curve, [9]));
        assert.throws(() => resampleCurve(curve, [], {9: 0.5}));
        assert.throws(() => resampleCurve(curve, [], {0: 0.5}));
        assert.throws(() => resampleCurve(curve, [], {1: 0.6, 2: 0.4, 3: 0.9}));
        assert.throws(() => resampleCurve(curve, [], {1: 0}));
    });
});

describe('spline: resampleCurves on a graph', function () {
    const edges = [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 4]];
    const points = [[0, 0], [1, 1], [3, 1], [8, 0], [0, 5], [4, 5], [2, 9]];

    it('can be limited to the curves with some points', function () {
        const moved = resampleCurves(points, edges, [], {}, 0.5, [5]);
        assert.deepEqual(moved.slice(0, 4), points.slice(0, 4)); // the chain was not asked for
        assert.notDeepEqual(moved[5], points[5]);
    });

    it('skips a curve with an unplaced point', function () {
        const gaps = points.map(p => p.slice());
        gaps[2] = [null, null];
        const moved = resampleCurves(gaps, edges);
        assert.deepEqual(moved.slice(0, 4), gaps.slice(0, 4));
    });
});
