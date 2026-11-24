'use strict';

/**
 * Catmull-Rom splines through landmarks, to resample a contour: move its points
 * along the curve they make so that they are evenly spaced, keeping some of them
 * (the anchors) where they are.
 *
 * This is the same algorithm as menpo's CatmullRom (menpo.shape.CatmullRom and
 * PointUndirectedGraph.resampled): test/fixtures/spline_golden.json has values
 * that menpo computed, which the tests reproduce. Points are arrays [x, y] or
 * [x, y, z]; nothing here depends on how they are drawn.
 */

const norm = (a, b) => Math.sqrt(a.reduce((s, v, k) => s + (v - b[k]) ** 2, 0));
const mix = (p, q, wp, wq) => p.map((v, k) => wp * v + wq * q[k]);

/**
 * Samples of a centripetal (alpha = 0.5) Catmull-Rom spline through `points`,
 * `resolution` per segment (the pyramidal formulation of Barry and Goldman).
 *
 * @return {{dense: number[][], controlIndex: number[]}} the samples and the
 *   index of each control point among them (a closed curve ends on its first)
 */
export function sampleCurve (points, closed, alpha = 0.5, resolution = 40) {
    const n = points.length;
    const first = points[0], second = points[1];
    const last = points[n - 1], beforeLast = points[n - 2];
    const padded = closed ?
        [last, ...points, points[0], points[1]] :
        [first.map((v, k) => 2 * v - second[k]), ...points,
         last.map((v, k) => 2 * v - beforeLast[k])];
    const segments = closed ? n : n - 1;
    const dense = [], controlIndex = [];

    for (let i = 0; i < segments; i++) {
        const [p0, p1, p2, p3] = padded.slice(i, i + 4);
        const t0 = 0;
        const t1 = t0 + Math.max(norm(p1, p0), 1e-6) ** alpha;
        const t2 = t1 + Math.max(norm(p2, p1), 1e-6) ** alpha;
        const t3 = t2 + Math.max(norm(p3, p2), 1e-6) ** alpha;
        controlIndex.push(i * resolution);
        for (let j = 0; j < resolution; j++) {
            const t = t1 + (t2 - t1) * j / resolution;
            const a1 = mix(p0, p1, (t1 - t) / (t1 - t0), (t - t0) / (t1 - t0));
            const a2 = mix(p1, p2, (t2 - t) / (t2 - t1), (t - t1) / (t2 - t1));
            const a3 = mix(p2, p3, (t3 - t) / (t3 - t2), (t - t2) / (t3 - t2));
            const b1 = mix(a1, a2, (t2 - t) / (t2 - t0), (t - t0) / (t2 - t0));
            const b2 = mix(a2, a3, (t3 - t) / (t3 - t1), (t - t1) / (t3 - t1));
            dense.push(mix(b1, b2, (t2 - t) / (t2 - t1), (t - t1) / (t2 - t1)));
        }
    }
    dense.push(closed ? dense[0] : points[n - 1]);
    controlIndex.push(dense.length - 1);
    return {dense, controlIndex};
}

/**
 * A curve through `points`: its samples, the arc length along them, the arc
 * length of each control point and the total length.
 */
export function makeCurve (points, closed = false, alpha = 0.5, resolution = 40) {
    const minimum = closed ? 3 : 2;
    if (points.length < minimum) {
        throw new Error(`a ${closed ? 'closed' : 'open'} curve needs at least ` +
                        `${minimum} points, got ${points.length}`);
    }
    const {dense, controlIndex} = sampleCurve(points, closed, alpha, resolution);
    const arc = [0];
    for (let i = 1; i < dense.length; i++) {
        arc.push(arc[i - 1] + norm(dense[i], dense[i - 1]));
    }
    return {
        points, closed, dense, arc,
        length: arc[arc.length - 1],
        arcPositions: controlIndex.slice(0, points.length).map(i => arc[i])
    };
}

/** The point of the curve at an arc length from its start. */
export function pointAt (curve, s) {
    const {arc, dense, closed, length} = curve;
    s = closed ? ((s % length) + length) % length : Math.min(Math.max(s, 0), length);
    // the last sample with arc <= s
    let lo = 0, hi = arc.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (arc[mid] <= s) {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    const span = arc[hi] - arc[lo];
    const w = span > 0 ? (s - arc[lo]) / span : 0;
    return dense[lo].map((v, k) => v + w * (dense[hi][k] - v));
}

/**
 * New positions of the points of a curve, evenly spaced between anchors: see
 * menpo's CatmullRom.resample.
 *
 * @param {Object} curve from makeCurve
 * @param {number[]} anchors indices of points that stay (the ends of an open
 *   curve always do; a closed curve has at least its first point)
 * @param {Object} spacing {point index: fraction of the arc between the anchors
 *   around it, strictly between 0 and 1 and increasing}
 * @return {number[][]} the new points
 */
export function resampleCurve (curve, anchors = [], spacing = {}) {
    const n = curve.points.length;
    anchors = [...new Set(anchors)].sort((a, b) => a - b);
    if (anchors.some(a => !Number.isInteger(a) || a < 0 || a >= n)) {
        throw new Error(`anchors must be point indices between 0 and ${n - 1}`);
    }
    const fractionOf = {};
    Object.keys(spacing).forEach(k => {
        if (!(k >= 0 && k < n)) {
            throw new Error('spacing has an index out of range');
        }
        fractionOf[Number(k)] = Number(spacing[k]);
    });
    if (curve.closed) {
        if (anchors.length === 0) {
            anchors = [0];
        }
    } else {
        anchors = [...new Set([...anchors, 0, n - 1])].sort((a, b) => a - b);
    }
    if (anchors.some(a => a in fractionOf)) {
        throw new Error('an anchor does not move: it cannot have a spacing');
    }

    const {arcPositions: arc, length} = curve;
    const out = curve.points.map(p => p.slice());
    let order, along, positions, start = 0;
    if (curve.closed) {
        start = anchors[0];
        order = [...Array(n - start).keys()].map(i => i + start)
            .concat([...Array(start).keys()]);
        along = order.map(i => (((arc[i] - arc[start]) % length) + length) % length);
        positions = anchors.map(a => order.indexOf(a)).concat([n]);
        along.push(length);
    } else {
        order = [...Array(n).keys()];
        along = arc;
        positions = anchors;
    }

    for (let m = 0; m + 1 < positions.length; m++) {
        const lo = positions[m], hi = positions[m + 1];
        const interior = order.slice(lo + 1, hi);
        if (interior.length === 0) {
            continue;
        }
        const fractions = interior.map(
            (i, k) => i in fractionOf ? fractionOf[i] : (k + 1) / (hi - lo));
        const increasing = fractions.every((f, k) => k === 0 || f > fractions[k - 1]);
        if (!fractions.every(f => f > 0 && f < 1) || !increasing) {
            throw new Error(`the spacing of points ${interior} must be fractions ` +
                            `that increase strictly between 0 and 1, got ${fractions}`);
        }
        interior.forEach((i, k) => {
            let s = along[lo] + fractions[k] * (along[hi] - along[lo]);
            if (curve.closed) {
                s += arc[start];
            }
            out[i] = pointAt(curve, s);
        });
    }
    return out;
}

/**
 * The curves that the edges of a graph make: its chains and loops. A component
 * that branches, or has fewer than three points, is not one. A chain starts at
 * its end with the smaller index; a loop at its smallest index, towards the
 * smaller of its two neighbours.
 *
 * @return {Array<{indices: number[], closed: boolean}>}
 */
export function curvesFromEdges (edges, nPoints) {
    const neighbours = Array.from({length: nPoints}, () => new Set());
    edges.forEach(([a, b]) => {
        if (a !== b) {
            neighbours[a].add(b);
            neighbours[b].add(a);
        }
    });
    const seen = new Array(nPoints).fill(false);
    const curves = [];
    for (let root = 0; root < nPoints; root++) {
        if (seen[root] || neighbours[root].size === 0) {
            continue;
        }
        const component = [], stack = [root];
        seen[root] = true;
        while (stack.length) {
            const v = stack.pop();
            component.push(v);
            neighbours[v].forEach(w => {
                if (!seen[w]) {
                    seen[w] = true;
                    stack.push(w);
                }
            });
        }
        if (component.length < 3 || component.some(v => neighbours[v].size > 2)) {
            continue;
        }
        const ends = component.filter(v => neighbours[v].size === 1).sort((a, b) => a - b);
        const closed = ends.length === 0;
        const start = closed ? Math.min(...component) : ends[0];
        const indices = [start];
        let previous = null, current = start;
        for (;;) {
            const options = [...neighbours[current]].filter(w => w !== previous)
                .sort((a, b) => a - b);
            if (options.length === 0 || options[0] === start) {
                break;
            }
            indices.push(options[0]);
            previous = current;
            current = options[0];
        }
        curves.push({indices, closed});
    }
    return curves;
}

/**
 * Resample every chain and loop of a graph: see menpo's resample_curves. Points
 * that no curve contains stay. Curves with a point that is not placed (null)
 * are skipped.
 *
 * @param {number[][]} points
 * @param {number[][]} edges
 * @param {number[]} anchors indices (global) of the points that stay
 * @param {Object} spacing {global index: fraction}
 * @param {number[]} only if given, only the curves with one of these points
 * @return {number[][]} the new points
 */
export function resampleCurves (points, edges, anchors = [], spacing = {},
                                alpha = 0.5, only = null) {
    const anchorSet = new Set(anchors);
    const result = points.map(p => p.slice());
    curvesFromEdges(edges, points.length).forEach(({indices, closed}) => {
        if (only && !indices.some(i => only.includes(i))) {
            return;
        }
        if (indices.some(i => points[i].some(v => v === null || v === undefined))) {
            return;
        }
        const local = new Map(indices.map((g, i) => [g, i]));
        const curve = makeCurve(indices.map(i => points[i]), closed, alpha);
        const localSpacing = {};
        Object.keys(spacing).forEach(g => {
            if (local.has(Number(g))) {
                localSpacing[local.get(Number(g))] = spacing[g];
            }
        });
        const moved = resampleCurve(
            curve, indices.filter(g => anchorSet.has(g)).map(g => local.get(g)),
            localSpacing);
        indices.forEach((g, i) => { result[g] = moved[i]; });
    });
    return result;
}

/**
 * Close every loop of a graph into a straight line, like a shut eye or mouth: its two ends (the
 * two anchors that are furthest apart, or if it has fewer than two the two points that are) stay,
 * and the points between them on the two sides go onto the straight line between the ends, the
 * ones facing each other exactly on top of each other, at the middle of where the two were
 * along the line. Of two sides with different numbers of points the pairs are made from the ends
 * and the points left over go to where they project on the line. Chains, and loops with a
 * point that is not placed (null), stay.
 *
 * @param {number[][]} points
 * @param {number[][]} edges
 * @param {number[]} anchors indices (global) of the points that are the template's anchors
 * @param {number[]} only if given, only the loops with one of these points
 * @return {number[][]} the new points
 */
export function closeLoops (points, edges, anchors = [], only = null) {
    const anchorSet = new Set(anchors);
    const result = points.map(p => p.slice());
    curvesFromEdges(edges, points.length).forEach(({indices, closed}) => {
        if (!closed || (only && !indices.some(i => only.includes(i)))) {
            return;
        }
        if (indices.some(i => points[i].some(v => v === null || v === undefined))) {
            return;
        }
        const n = indices.length;
        const anchored = indices.map((g, k) => k).filter(k => anchorSet.has(indices[k]));
        const candidates = anchored.length >= 2 ? anchored : indices.map((g, k) => k);
        let ends = [candidates[0], candidates[1]], widest = -1;
        candidates.forEach((i, x) => candidates.slice(x + 1).forEach((j) => {
            const d = Math.hypot(...points[indices[i]].map((v, c) => v - points[indices[j]][c]));
            if (d > widest) {
                widest = d;
                ends = [i, j];
            }
        }));
        const [i, j] = ends;
        // the two sides, both from the end i to the end j
        const side = (from, to) => {
            const out = [];
            for (let k = (from + 1) % n; k !== to; k = (k + 1) % n) {
                out.push(k);
            }
            return out;
        };
        const first = side(i, j);
        const second = side(j, i).reverse();
        const a = points[indices[i]], b = points[indices[j]];
        const axis = b.map((v, c) => v - a[c]);
        const length2 = axis.reduce((sum, v) => sum + v * v, 0);
        if (length2 === 0) {
            return;
        }
        // where along the line (0 at the end i, 1 at j) a point projects
        const along = (k) => Math.min(1, Math.max(0, points[indices[k]].reduce(
            (sum, v, c) => sum + (v - a[c]) * axis[c], 0) / length2));
        const put = (k, t) => { result[indices[k]] = a.map((v, c) => v + t * axis[c]); };
        const paired = Math.min(first.length, second.length);
        for (let x = 0; x < paired; x++) {
            const t = (along(first[x]) + along(second[x])) / 2;
            put(first[x], t);
            put(second[x], t);
        }
        first.slice(paired).concat(second.slice(paired)).forEach(k => put(k, along(k)));
    });
    return result;
}

/**
 * The segments to draw for one curve (a chain or a loop of landmarks): the spline
 * through the points when they are all placed, so that what is drawn is the curve that
 * "space evenly" slides the points along; otherwise straight segments between the
 * neighbours that are placed.
 *
 * @param {Array<number[]|null>} points in order along the curve, null if not placed
 * @param {boolean} closed
 * @param {number} resolution samples per span of the spline
 * @return {Array<[number[], number[]]>} pairs of points
 */
export function curveSegments (points, closed, resolution = 12) {
    const n = points.length;
    const pairs = [];
    if (n >= 3 && points.every(p => p)) {
        const {dense} = sampleCurve(points, closed, 0.5, resolution);
        for (let i = 0; i + 1 < dense.length; i++) {
            pairs.push([dense[i], dense[i + 1]]);
        }
        return pairs;
    }
    for (let i = 0; i + 1 < n + (closed && n > 2 ? 1 : 0); i++) {
        const a = points[i], b = points[(i + 1) % n];
        if (a && b) {
            pairs.push([a, b]);
        }
    }
    return pairs;
}
