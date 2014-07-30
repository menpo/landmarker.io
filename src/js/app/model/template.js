var _ = require('underscore');
var Backbone = require('../lib/backbonej');

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
