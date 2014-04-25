var _ = require('underscore');
var Backbone = require('backbone');
var $ = require('jquery');

"use strict";

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
            this.$el.find('#textureToggle').toggleClass('Button--Disabled',
                !this.mesh.hasTexture());
            this.$el.find('#textureToggle').toggleClass('Button-Toolbar-On',
                this.mesh.isTextureOn());
            this.$el.find('#wireframeToggle').toggleClass('Button-Toolbar-On',
                this.mesh.isWireframeOn());
        } else {
            this.$el.find('#textureToggle').addClass('Button--Disabled');
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
