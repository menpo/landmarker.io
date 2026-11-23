import { assert } from 'chai';
import { describe, it } from 'vitest';

import Template from '../../src/js/app/template';

const yaml = `
groups:
  - label: jaw
    points: 5
    connectivity: ['0:4']
    anchors: [0, 2, 4]
    spacing: {1: 0.4, 3: 0.6}
  - label: eye
    points: 4
    connectivity: cycle
    anchors: [0]
  - label: dot
    points: 1
`;

describe('Template anchors and spacing', function () {
    it('are read from YAML, per group', function () {
        const t = Template.parseYAML(yaml);
        assert.deepEqual(t.groups[0].anchors, [0, 2, 4]);
        assert.deepEqual(t.groups[0].spacing, {1: 0.4, 3: 0.6});
        assert.deepEqual(t.groups[1].anchors, [0]);
        assert.isUndefined(t.groups[1].spacing);
        assert.isUndefined(t.groups[2].anchors);
    });

    it('are global in the labels of the LJSON, with the offsets of the groups', function () {
        const {labels} = Template.parseYAML(yaml).emptyLJSON(2);
        assert.deepEqual(labels[0], {
            label: 'jaw', mask: [0, 1, 2, 3, 4], anchors: [0, 2, 4],
            spacing: {1: 0.4, 3: 0.6}
        });
        assert.deepEqual(labels[1], {label: 'eye', mask: [5, 6, 7, 8], anchors: [5]});
        assert.deepEqual(labels[2], {label: 'dot', mask: [9]});
    });

    it('come back from an LJSON, relative to their group', function () {
        const t = Template.parseYAML(yaml);
        const again = Template.parseLJSON(t.emptyLJSON(2));
        assert.deepEqual(again.groups[0].anchors, [0, 2, 4]);
        assert.deepEqual(again.groups[0].spacing, {1: 0.4, 3: 0.6});
        assert.deepEqual(again.groups[1].anchors, [0]);
        assert.deepEqual(again.emptyLJSON(2).labels, t.emptyLJSON(2).labels);
    });

    it('do not make a file without them invalid (files saved before they existed)', function () {
        const t = Template.parseYAML(yaml);
        const old = JSON.parse(JSON.stringify(t.emptyLJSON(2)));
        old.labels.forEach(l => { delete l.anchors; delete l.spacing; });
        old.landmarks.points = old.landmarks.points.map(() => [1, 2]);
        const [ok, json] = t.validate(old, 2);
        assert.isTrue(ok);
        assert.equal(json, old);   // the saved landmarks are kept, not replaced by an empty template
    });

    it('do not hide a different set of labels', function () {
        const t = Template.parseYAML(yaml);
        const other = JSON.parse(JSON.stringify(t.emptyLJSON(2)));
        other.labels[0].label = 'chin';
        assert.isFalse(t.validate(other, 2)[0]);
    });

    it('refuse nonsense', function () {
        const bad = (extra) => () => Template.parseYAML(
            `groups:\n  - label: a\n    points: 5\n    connectivity: ['0:4']\n${extra}`);
        assert.throws(bad('    anchors: [9]\n'), /anchors/);
        assert.throws(bad('    anchors: [0.5]\n'), /anchors/);
        assert.throws(bad('    spacing: {1: 1.5}\n'), /spacing/);
        assert.throws(bad('    spacing: {7: 0.5}\n'), /spacing/);
        assert.throws(bad('    anchors: [2]\n    spacing: {2: 0.5}\n'), /spacing/);
    });
});
