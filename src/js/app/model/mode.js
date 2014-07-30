var Backbone = require('../lib/backbonej');

"use strict";


exports.Mode = Backbone.Model.extend({

    url: function () {
        return this.get('server').map("mode");
    }
});
