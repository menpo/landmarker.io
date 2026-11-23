// @vitest-environment jsdom
import { assert } from 'chai';
import { describe, it } from 'vitest';

import { resampleText } from '../../src/js/app/view/sidebar';

describe('resampleText', function () {
    it('says what the button spaces: all, or the selected curves by name', function () {
        assert.equal(resampleText(null), 'Space evenly');
        assert.equal(resampleText(['jaw']), 'Space selected (jaw)');
        assert.equal(resampleText(['jaw', 'nose']), 'Space selected (jaw, nose)');
        assert.equal(resampleText([]), 'Space selected');
    });
});
