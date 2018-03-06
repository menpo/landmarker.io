'use strict';

import _ from 'underscore';
import Backbone from 'backbone';
import atomic from '../model/atomic';
import $ from 'jquery';

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
        this.$el[0].value = this.model.get("landmarkSize") * 100;
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

export const ConnectivityToggle = Backbone.View.extend({

    el: '#connectivityRow',

    events: {
        'click #connectivityToggle': "connectivityToggle"
    },

    initialize: function () {
        this.$toggle = this.$el.find('#connectivityToggle')[0];
        _.bindAll(this, 'render', 'connectivityToggle');
        this.listenTo(this.model, 'change:connectivityOn', this.render);
        this.render();
    },

    render: function () {
        this.$toggle.checked = this.model.isConnectivityOn();
        return this;
    },

    connectivityToggle: function () {
        this.model.toggleConnectivity();
    }
});

export const EditingToggle = Backbone.View.extend({

    el: '#editingRow',

    events: {
        'click #editingToggle': "editingToggle"
    },

    initialize: function () {
        this.$toggle = this.$el.find('#editingToggle')[0];
        _.bindAll(this, 'render', 'editingToggle');
        this.listenTo(this.model, 'change:editingOn', this.render);
        this.render();
    },

    render: function () {
        this.$toggle.checked = this.model.isEditingOn();
        return this;
    },

    editingToggle: function () {
        this.model.toggleEditing();
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

export const LandMarkChangedStatus = Backbone.View.extend({

    el: '#LandMarkChangedStatus',

    events: {
        'change status': "toggle"
    },

    initialize: function () {
        _.bindAll(this, 'render', 'changeLandMarkStatus');
        //init data
        this.index;
        this.invisible;
        this.bad;

        //listener
        var changeTolbarDotStatus = _.extend({}, Backbone.Events);
        changeTolbarDotStatus.listenTo(Backbone, 'changeStatusInToolbar', (lm)=>{
            this.index = lm.attributes.index;
            this.invisible = lm.attributes.invisible;
            this.bad = lm.attributes.bad;
            this.render();
       });
        this.render();
    },

    render: function () {
        if(this.index){
            var invisible = this.invisible ? 'Yes' : 'No';
            var bad =  this.bad ? 'Yes' : 'No';
            $('#LandMarkChangedStatus').css("display", "flex");
            $('#LM-Index').html((parseInt(this.index) + 1).toString());
            $('#LM-Invisible').html(invisible);
            $('#LM-Bad').html(bad);
        } else {
            $('#LandMarkChangedStatus').css("display", "none");
        }
    },

    changeLandMarkStatus: function(lm){
        this.index = lm.attributes.index;
        this.invisible = lm.attributes.invisible;
        this.bad = lm.attributes.bad;
    }

});

export default Backbone.View.extend({

    el: '#toolbar',

    initialize: function () {
        this.lmSizeSlider = new LandmarkSizeSlider({model: this.model});
        this.connectivityToggle = new ConnectivityToggle({model: this.model});
        this.editingToggle = new EditingToggle({model: this.model});
        if (this.model.meshMode()) {
            this.textureToggle = new TextureToggle({model: this.model});
        } else {
            // in image mode, we shouldn't even have these controls.
            this.$el.find('#textureRow').css("display", "none");
        }
        this.autosaveToggle = new AutoSaveToggle({model: this.model});
        this.landMarkChangedStatus = new LandMarkChangedStatus({model: this.model});
    }

});
