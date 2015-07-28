'use strict';

import Backbone from 'backbone';
import $ from 'jquery';

const HELP_CONTENTS = [
    ['j', 'go to next asset in collection'],
    ['k', 'go to previous asset in collection'],
    [''],
    ['right click', 'insert next available landmark'],
    ['snap + click', 'move snapped landmark'],
    ['snap + ctrl + move', 'lock snapped landmark'],
    [''],
    ['a', 'select all landmarks'],
    ['g', 'select all landmarks in the active group'],
    ['d', 'delete selected landmarks'],
    ['q / ESC', 'clear current selection'],
    ['z', 'undo last operation'],
    ['y', 'redo last undone operation'],
    ['ctrl + s', 'save current landmarks'],
    ['click outside', 'clear current selection'],
    ['ctrl/cmd + click on landmark', 'select and deselect from current selection'],
    ['click on a landmark', 'select a landmark'],
    ['click + drag on a landmark', 'move landmark points'],
    ['shift + drag not on a landmark', 'draw a box to select multiple landmarks'],
    ['ctrl + shift + drag not on a landmark', 'draw a box to add multiple landmarks to current selection'],
    [''],
    ['l', 'toggle links (landmark connections)'],
    ['t', 'toggle textures (<i>mesh mode only</i>)'],
    ['c', 'change between orthographic and perspective rendering (<i>mesh mode only</i>)'],
    [''],
    ['r', 'reset the camera to default'],
    ['mouse wheel', 'zoom the camera in and out'],
    ['click + drag', 'rotate camera (<i>mesh mode only</i>)'],
    ['right click + drag', 'pan the camera'],
    [''],
    ['?', 'display this help']
];

export default Backbone.View.extend({

    el: '#helpOverlay',

    events: { click: 'close' },

    initialize: function() {
        this.listenTo(this.model, 'change:helpOverlayIsDisplayed', this.render);
        var $tbody = this.$el.children('table').children('tbody');
        HELP_CONTENTS.forEach(function ([key, msg]) {
            $tbody.append(
                msg ? $(`<tr><td>${key}</td><td>${msg}</td></tr>`) :
                      $(`<tr class='title'><td>${key}</td><td></td></tr>`)
            );
        });

        this.render();
    },

    render: function () {
        this.$el.toggleClass('Display', this.model.isHelpOverlayOn());
    },

    close: function () {
        this.model.toggleHelpOverlay();
    }
});
