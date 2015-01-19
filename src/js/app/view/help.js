var _ = require('underscore');
var Backbone = require('../lib/backbonej');

"use strict";


var DISPLAY_STYLE_FOR_HELP_ON = {
    true: 'flex',
    false: 'none'
};


var toggleHelp = function (e) {
    e.stopPropagation();
    this.model.toggleHelpOverlay();
    window.document.removeEventListener('click', this.toggleHelp)
};

module.exports = Backbone.View.extend({

    el: '#helpOverlay',

    initialize : function() {
        this.listenTo(this.model, "change:helpOverlayIsDisplayed", this.render);
        this.render();
        this.el = this.$el[0];
        this.toggleHelp = toggleHelp.bind(this);
    },


    render: function () {
        window.document.removeEventListener('click', this.toggleHelp);
        var isOn = this.model.isHelpOverlayOn();
        this.el.style.display = DISPLAY_STYLE_FOR_HELP_ON[isOn];
        if (isOn) {
            window.document.addEventListener('click', this.toggleHelp);
        }
    }
});
