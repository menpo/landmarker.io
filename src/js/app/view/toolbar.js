'use strict';

import _ from 'underscore';
import Backbone from 'backbone';
import atomic from '../model/atomic';


export const LandmarkSizeSlider = Backbone.View.extend({

    el: '#lmSizeSlider',

    events: {
        input: "changeLandmarkSize"
    },

    initialize: function () {
        _.bindAll(this, 'render', 'changeLandmarkSize');
        this.listenTo(this.model, "change:landmarkSize", this.render);
        // set the size immediately.
        this.render();
    },

    render: function () {
        this.$el[0].value = this.model.landmarkSize() * 100;
        return this;
    },

    changeLandmarkSize: atomic.atomicOperation(function (event) {
        this.model.set(
            "landmarkSize",
            Math.max(Number(event.target.value) / 100, 0.05));
    })
});

export const TextureToggle = Backbone.View.extend({

    el: '#textureRow',

    events: {
        'click #textureToggle': "textureToggle"
    },

    initialize: function () {
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
        if (this.mesh) {
            this.stopListening(this.mesh);
        }
        this.listenTo(this.model.asset(), "all", this.render);
        this.mesh = this.model.asset();
    },

    render: function () {
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
        if (!this.mesh) {
            return;
        }
        this.mesh.textureToggle();
    }
});


export const AutoSaveToggle = Backbone.View.extend({

    el: '#autosaveRow',

    events: {
        'click #autosaveToggle': "toggle"
    },

    initialize: function () {
        this.$toggle = this.$el.find('#autosaveToggle')[0];
        _.bindAll(this, 'render', 'toggle');
        this.listenTo(this.model, 'change:autoSaveOn', this.render);
        this.render();
    },

    render: function () {
        this.$toggle.checked = this.model.isAutoSaveOn();
        return this;
    },

    toggle: function () {
        this.model.toggleAutoSave();
    }
});

export default Backbone.View.extend({

    el: '#toolbar',

    initialize: function () {
        this.lmSizeSlider = new LandmarkSizeSlider({model: this.model});
        if (this.model.meshMode()) {
            this.textureToggle = new TextureToggle({model: this.model});
        } else {
            // in image mode, we shouldn't even have these controls.
            this.$el.find('#textureRow').css("display", "none");
        }
        this.autosaveToggle = new AutoSaveToggle({model: this.model});
    }

});
