import {
    curveSegments, readFileSync } from 'node:fs';
import { assert } from 'chai';
import { describe, it } from 'vitest';

import {
    closeLoops, curveSegments, curvesFromEdges, makeCurve, pointAt, resampleCurve, resampleCurves
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

describe('curveSegments', function () {
    const OPEN = [[0, 0], [10, 5], [20, 0], [30, 8]];
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9;
    const chained = (pairs) => pairs.every((pair, i) => i === 0 || near(pair[0], pairs[i - 1][1]));

    it('is the spline through the points when they are all placed', function () {
        const pairs = curveSegments(OPEN, false, 8);
        assert.equal(pairs.length, 3 * 8);
        assert.isTrue(chained(pairs));
        // it passes through every control point, and starts and ends on the ends
        OPEN.forEach(p => assert.isTrue(
            pairs.some(([a, b]) => near(a, p) || near(b, p))));
        assert.isTrue(near(pairs[0][0], OPEN[0]));
        assert.isTrue(near(pairs[pairs.length - 1][1], OPEN[3]));
        // and it is the curve that resampling uses: its samples are on makeCurve's
        const {dense} = makeCurve(OPEN, false, 0.5, 8);
        assert.isTrue(pairs.every(([a]) => dense.some(q => near(a, q))));
    });

    it('closes a loop', function () {
        const loop = [[0, 0], [10, 0], [10, 10], [0, 10]];
        const pairs = curveSegments(loop, true, 6);
        assert.equal(pairs.length, 4 * 6);
        assert.isTrue(near(pairs[0][0], loop[0]));
        assert.isTrue(near(pairs[pairs.length - 1][1], loop[0]));
    });

    it('is straight segments between the placed neighbours while the curve is incomplete', function () {
        const pairs = curveSegments([[0, 0], [10, 5], null, [30, 8]], false);
        assert.deepEqual(pairs, [[[0, 0], [10, 5]]]);
        const loop = curveSegments([[0, 0], [10, 0], [10, 10], null], true);
        assert.deepEqual(loop, [[[0, 0], [10, 0]], [[10, 0], [10, 10]]]);
        const closing = curveSegments([[0, 0], null, [10, 10], [0, 10]], true);
        assert.deepEqual(closing, [[[10, 10], [0, 10]], [[0, 10], [0, 0]]]);
    });

    it('draws nothing for nothing placed', function () {
        assert.deepEqual(curveSegments([null, null, null], false), []);
    });
});


describe('closeLoops: a loop shut into one curve', function () {
    // an eye: left corner, two points on the upper lid, right corner, two on the lower lid
    const EYE = [[0, 0], [3, 2], [7, 2.5], [10, 2], [7, -2], [3, -1.5]];
    const LOOP = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]];
    const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);

    it('keeps the corners and puts each pair half way between its two points', function () {
        const shut = closeLoops(EYE, LOOP, [0, 3]);
        assert.deepEqual(shut[0], EYE[0]);
        assert.deepEqual(shut[3], EYE[3]);
        // facing points: the upper ones and the lower ones, from the same end
        assert.deepEqual(shut[1], shut[5]);
        assert.deepEqual(shut[2], shut[4]);
        close([shut[1]], [[3, 0.25]], 1e-9, 'first pair');
        close([shut[2]], [[7, 0.25]], 1e-9, 'second pair');
    });

    it('keeps the curve: a bent eye does not become a straight line', function () {
        const bent = [[0, 0], [3, 3], [7, 3], [10, 0], [7, 1], [3, 1]];
        const shut = closeLoops(bent, LOOP, [0, 3]);
        assert.isAbove(shut[1][1], 1);
        assert.isAbove(shut[2][1], 1);
    });

    it('does not need the corners to be the first points, or anchors', function () {
        // the same eye starting from a point of the lower lid, with no anchors at all
        const order = [4, 5, 0, 1, 2, 3];
        const points = order.map(k => EYE[k]);
        const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]];
        const shut = closeLoops(points, edges);
        const original = closeLoops(EYE, LOOP, [0, 3]);
        order.forEach((k, i) => close([shut[i]], [original[k]], 1e-9, `point ${k}`));
    });

    it('takes the anchors that are furthest apart as the corners of a loop with more', function () {
        // the corners and the middle of the upper and lower lip of a mouth
        const mouth = [[0, 0], [5, 1], [10, 0], [5, -1]];
        const shut = closeLoops(mouth, [[0, 1], [1, 2], [2, 3], [3, 0]], [0, 1, 2, 3]);
        assert.deepEqual(shut[0], mouth[0]);
        assert.deepEqual(shut[2], mouth[2]);
        assert.deepEqual(shut[1], [5, 0]);
        assert.deepEqual(shut[3], [5, 0]);
    });

    it('pairs from the corners when the sides have different numbers of points', function () {
        const points = [[0, 0], [2, 1], [5, 1], [8, 1], [10, 0], [6, -1]];
        const shut = closeLoops(points, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]], [0, 4]);
        // the first pair (1 and 5) meets half way between them
        assert.deepEqual(shut[1], [4, 0]);
        assert.deepEqual(shut[5], [4, 0]);
        // the others go to the nearest place on the line through the ends and that pair
        close([shut[2]], [[5, 0]], 1e-9, 'point 2');
        close([shut[3]], [[8, 0]], 1e-9, 'point 3');
    });

    it('leaves chains, loops with an unplaced point, and loops that were not asked for', function () {
        const chain = [[0, 0], [1, 1], [2, 0]];
        assert.deepEqual(closeLoops(chain, [[0, 1], [1, 2]]), chain);
        const gap = EYE.map(p => p.slice());
        gap[2] = [null, null];
        assert.deepEqual(closeLoops(gap, LOOP, [0, 3]), gap);
        assert.deepEqual(closeLoops(EYE, LOOP, [0, 3], [20]), EYE);
        assert.notDeepEqual(closeLoops(EYE, LOOP, [0, 3], [2]), EYE);
        // and it does not change what it was given
        const before = JSON.stringify(EYE);
        closeLoops(EYE, LOOP, [0, 3]);
        assert.equal(JSON.stringify(EYE), before);
    });

    it('is idempotent, and does nothing to a loop whose ends are on one point', function () {
        const once = closeLoops(EYE, LOOP, [0, 3]);
        close(closeLoops(once, LOOP, [0, 3]), once, 1e-9, 'twice');
        const same = [[1, 1], [1, 1], [1, 1], [1, 1]];
        assert.deepEqual(closeLoops(same, [[0, 1], [1, 2], [2, 3], [3, 0]]), same);
    });

    it('keeps points that stick out past a corner on the curve, at its end', function () {
        const points = [[0, 0], [5, 1], [10, 0], [12, -1], [5, -1], [-2, -1]];
        const shut = closeLoops(points, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]], [0, 2]);
        assert.deepEqual(shut[3], [10, 0]);      // past the second corner: its end
        assert.deepEqual(shut[4], [5, 0]);
        // 1 and 5 are a pair: half way between them
        assert.deepEqual(shut[1], [1.5, 0]);
        assert.deepEqual(shut[5], [1.5, 0]);
    });
});
