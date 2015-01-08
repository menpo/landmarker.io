var _ = require('underscore');
var Backbone = require('backbone');
var $ = require('jquery');
var atomic = require('../model/atomic');

"use strict";

var LandmarkSizeSlider = Backbone.View.extend({

    el: '#lmSizeSlider',

    events: {
        input : "changeLandmarkSize"
    },

    initialize : function() {
        console.log('LandmarkSizeSlider:initialize');
        _.bindAll(this, 'render', 'changeLandmarkSize');
        this.listenTo(this.model, "change:landmarkSize", this.render);
        // set the size immediately.
        this.render();
    },


    render: function () {
        console.log('LandmarkSizeSlider:render');
        this.$el[0].value = this.model.get("landmarkSize") * 50;
        return this;
    },

    changeLandmarkSize: atomic.atomicOperation(function (event) {
        console.log('LandmarkSizeSlider:changeLandmarkSize');
        this.model.set("landmarkSize", (Number(event.target.value) / 50));
    })
});


var AlphaSlider = Backbone.View.extend({

    el: '#alphaSlider',

    events: {
        input : "changeAlpha"
    },

    initialize : function() {
        console.log('AlphaSlider:initialize');
        _.bindAll(this, 'render', 'changeAlpha');
        this.listenTo(this.model, "change:meshAlpha", this.render);
    },

    render: function () {
        console.log('AlphaSlider:render');
        this.$el[0].value = this.model.get("meshAlpha") * 100;
        return this;
    },

    changeAlpha: function (event) {
        console.log('AlphaSlider:changeAlpha');
        this.model.set("meshAlpha", (Number(event.target.value) / 100));
    }
});


var TextureToggle = Backbone.View.extend({

    el: '#textureRow',

    events: {
        'click #textureToggle' : "textureToggle"
    },

    initialize : function() {
        console.log('TextureToggle:initialize');
        this.$toggle = this.$el.find('#textureToggle')[0];
        _.bindAll(this, 'changeMesh', 'render', 'textureToggle');
        this.listenTo(this.model, "change:mesh", this.changeMesh);
        // there could already be a model we have missed
        if (this.model.mesh()) {
            this.changeMesh();
        }
        this.render();
    },

    changeMesh: function () {
        console.log('TextureToggle:changeMesh');
        if (this.mesh) {
            this.stopListening(this.mesh);
        }
        this.listenTo(this.model.asset(), "all", this.render);
        this.mesh = this.model.asset();
    },

    render: function () {
        console.log('TextureToggle:render');
        if (this.mesh) {
            this.$el.toggleClass('Toolbar-Row--Disabled',
                !this.mesh.hasTexture());
            this.$toggle.checked = this.mesh.isTextureOn();
        } else {
            this.$el.addClass('Toolbar-Row--Disabled');
        }
        return this;
    },

    textureToggle: function () {
        console.log('TextureToggle:textureToggle');
        if (!this.mesh) {
            return;
        }
        this.mesh.textureToggle();
    }
});


exports.Toolbar = Backbone.View.extend({

    el: '#toolbar',

    initialize : function () {
        console.log('Toolbar:initialize');
        this.lmSizeSlider = new LandmarkSizeSlider({model: this.model});
        // For now we remove alpha support
        this.$el.find('#alphaRow').css("display", "none");
        if (this.model.meshMode()) {
            // only in mesh mode do we add these toolbar items.
            //this.alphaSlider = new AlphaSlider({model: this.model});
            this.textureToggle = new TextureToggle({model: this.model});
        } else {
            // in image mode, we shouldn't even have these controls.
            this.$el.find('#alphaRow').css("display", "none");
            this.$el.find('#textureRow').css("display", "none");
        }
    }

});
