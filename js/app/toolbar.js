var _ = require('underscore');
var Backbone = require('backbone');
var $ = require('jquery');

"use strict";
// TODO this should be split for each item a-la sidebar.

exports.Toolbar = Backbone.View.extend({

    el: '#toolbar',

    initialize : function() {
        _.bindAll(this, 'render', 'changeMesh',
            'textureToggle', 'wireframeToggle');
        this.listenTo(this.model, "change:mesh", this.changeMesh);
        if (this.model.mesh()) {
            this.changeMesh();
        }
        this.render();
    },

    changeMesh: function () {
        console.log('changing mesh binding for Toolbar');
        if (this.mesh) {
            this.stopListening(this.mesh);
        }
        this.listenTo(this.model.mesh(), "all", this.render);
        this.mesh = this.model.mesh();
    },

    events: {
        'click #textureToggle' : "textureToggle",
        'click #wireframeToggle' : "wireframeToggle"
    },

    render: function () {
        if (this.mesh) {
            this.$el.find('#textureRow').toggleClass('Toolbar-Row--Disabled',
                !this.mesh.hasTexture());
            this.$el.find('#textureToggle')[0].checked = this.mesh.isTextureOn();
            this.$el.find('#wireframeToggle')[0].checked = this.mesh.isWireframeOn();
        } else {
            this.$el.find('#textureRow').addClass('Toolbar-Row--Disabled');
        }
        return this;
    },

    textureToggle: function () {
        console.log('textureToggle called');
        if (!this.mesh) {
            return;
        }
        this.mesh.textureToggle();
    },

    wireframeToggle: function () {
        console.log('wireframeToggle called');
        if (!this.mesh) {
            return;
        }
        this.mesh.wireframeToggle();
    }

});
