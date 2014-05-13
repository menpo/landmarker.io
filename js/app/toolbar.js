var _ = require('underscore');
var Backbone = require('backbone');
var $ = require('jquery');

"use strict";

var LandmarkSizeSlider = Backbone.View.extend({

    el: '#lmSizeSlider',

    initialize : function() {
        _.bindAll(this, 'render', 'changeLandmarkSize');
        this.listenTo(this.model, "change:landmarkSize", this.render);
        // set the size immediately.
        this.render();
    },

    events: {
        input : "changeLandmarkSize"
    },

    render: function () {
        this.$el[0].value = this.model.get("landmarkSize") * 50;
        return this;
    },

    changeLandmarkSize: function (event) {
        // turn on batch rendering before firing the change
        this.model.dispatcher().enableBatchRender();
        this.model.set("landmarkSize", (Number(event.target.value) / 50));
        // all symbols will be updated - disable the batch
        this.model.dispatcher().disableBatchRender();
    }
});


var AlphaSlider = Backbone.View.extend({

    el: '#alphaSlider',

    initialize : function() {
        _.bindAll(this, 'render', 'changeAlpha');
        this.listenTo(this.model, "change:meshAlpha", this.render);
    },

    events: {
        input : "changeAlpha"
    },

    render: function () {
        console.log('slider:render');
        this.$el[0].value = this.model.get("meshAlpha") * 100;
        return this;
    },

    changeAlpha: function (event) {
        console.log('slider:changeAlpha');
        this.model.set("meshAlpha", (Number(event.target.value) / 100));
    }
});


var TextureToggle = Backbone.View.extend({

    el: '#textureRow',

    initialize : function() {
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
        console.log('changing mesh binding for TextureToggle');
        if (this.mesh) {
            this.stopListening(this.mesh);
        }
        this.listenTo(this.model.mesh(), "all", this.render);
        this.mesh = this.model.mesh();
    },

    events: {
        'click #textureToggle' : "textureToggle"
    },

    render: function () {
        console.log('slider:render');
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
        console.log('textureToggle called');
        if (!this.mesh) {
            return;
        }
        this.mesh.textureToggle();
    }
});


var WireframeToggle = Backbone.View.extend({

    el: '#wireframeRow',

    initialize : function() {
        this.$toggle = this.$el.find('#wireframeToggle')[0];
        _.bindAll(this, 'changeMesh', 'render', 'wireframeToggle');
        this.listenTo(this.model, "change:mesh", this.changeMesh);
        // there could already be a model we have missed
        if (this.model.mesh()) {
            this.changeMesh();
        }
        this.render();
    },

    changeMesh: function () {
        console.log('changing mesh binding for WireframeToggle');
        if (this.mesh) {
            this.stopListening(this.mesh);
        }
        this.listenTo(this.model.mesh(), "all", this.render);
        this.mesh = this.model.mesh();
    },

    events: {
        'click #wireframeToggle' : "wireframeToggle"
    },

    render: function () {
        if (this.mesh) {
            this.$toggle.checked = this.mesh.isWireframeOn();
        }
        return this;
    },

    wireframeToggle: function () {
        console.log('wireframeToggle called');
        if (!this.mesh) {
            return;
        }
        this.mesh.wireframeToggle();
    }
});



exports.Toolbar = Backbone.View.extend({

    el: '#toolbar',

    initialize : function() {
        this.lmSizeSlider = new LandmarkSizeSlider({model: this.model});
        if (this.model.meshMode()) {
            // only in mesh mode do we add these toolbar items.
            this.alphaSlider = new AlphaSlider({model: this.model});
            this.textureToggle = new TextureToggle({model: this.model});
            this.wireframeToggle = new WireframeToggle({model: this.model});
        } else {
            // in image mode, we shouldn't even have these controls.
            this.$el.find('#alphaRow').css("display", "none");
            this.$el.find('#textureRow').css("display", "none");
            this.$el.find('#wireframeRow').css("display", "none");
        }
    }

});
