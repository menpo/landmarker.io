var Backbone = require('backbone');
var _ = require('underscore');
Backbone.$ = require('jquery');

"use strict";


var TemplateLabels = Backbone.Model.extend({

    urlRoot: "templates",

    url: function () {
        return this.get('server').map(this.urlRoot);
    },

    parse: function (json, options) {
        if (!options.parse) {
            return;
        }
        return {labels: json};
    }

});

exports.TemplateLabels = TemplateLabels;
