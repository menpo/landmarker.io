var _ = require('underscore');
var Backbone = require('../lib/backbonej');

"use strict";


var DISPLAY_STYLE_FOR_HELP_ON = {
    true: 'flex',
    false: 'none'
};

module.exports = Backbone.View.extend({

    el: '#helpOverlay',

    events: { click: 'close' },

    initialize : function() {
        this.listenTo(this.model, "change:helpOverlayIsDisplayed", this.render);
        this.el = this.$el[0];
        this.render();
    },

    render: function () {
        var isOn = this.model.isHelpOverlayOn();
        this.el.style.display = DISPLAY_STYLE_FOR_HELP_ON[isOn];
    },

    close: function () {
        this.model.toggleHelpOverlay();
    }
});
