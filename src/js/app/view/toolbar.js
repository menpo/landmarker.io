var _ = require('underscore');
var Backbone = require('../lib/backbonej');
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
        this.$el[0].value = this.model.get("landmarkSize") * 100;
        return this;
    },

    changeLandmarkSize: atomic.atomicOperation(function (event) {
        console.log('LandmarkSizeSlider:changeLandmarkSize');
        this.model.set("landmarkSize", (Number(event.target.value) / 100));
    })
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
        this.listenTo(this.model, "newMeshAvailable", this.changeMesh);
        // there could already be an asset we have missed
        if (this.model.asset()) {
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


var ConnectivityToggle = Backbone.View.extend({

    el: '#connectivityRow',

    events: {
        'click #connectivityToggle' : "connectivityToggle"
    },

    initialize : function() {
        console.log('ConnectivityToggle:initialize');
        this.$toggle = this.$el.find('#connectivityToggle')[0];
        _.bindAll(this, 'render', 'connectivityToggle');
        this.listenTo(this.model, 'change:connectivityOn', this.render);
        this.render();
    },

    render: function () {
        console.log('ConnectivityToggle:render');
        this.$toggle.checked = this.model.isConnectivityOn();
        return this;
    },

    connectivityToggle: function () {
        console.log('ConnectivityToggle:connectivityToggle');
        this.model.toggleConnectivity();
    }
});

var EditingToggle = Backbone.View.extend({

    el: '#editingRow',

    events: {
        'click #editingToggle' : "editingToggle"
    },

    initialize : function() {
        console.log('ConnectivityToggle:initialize');
        this.$toggle = this.$el.find('#editingToggle')[0];
        _.bindAll(this, 'render', 'editingToggle');
        this.listenTo(this.model, 'change:editingOn', this.render);
        this.render();
    },

    render: function () {
        console.log('EditingToggle:render');
        this.$toggle.checked = this.model.isEditingOn();
        return this;
    },

    editingToggle: function () {
        console.log('EditingToggle:editingToggle');
        this.model.toggleEditing();
    }
});

exports.Toolbar = Backbone.View.extend({

    el: '#toolbar',

    initialize : function () {
        console.log('Toolbar:initialize');
        this.lmSizeSlider = new LandmarkSizeSlider({model: this.model});
        this.connectivityToggle = new ConnectivityToggle({model : this.model});
        this.editingToggle = new EditingToggle({model : this.model});
        if (this.model.meshMode()) {
            this.textureToggle = new TextureToggle({model: this.model});
        } else {
            // in image mode, we shouldn't even have these controls.
            this.$el.find('#alphaRow').css("display", "none");
            this.$el.find('#textureRow').css("display", "none");
        }
    }

});
