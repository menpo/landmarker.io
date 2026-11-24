'use strict';

import $ from 'jquery';
import Backbone from 'backbone';

import { notify } from './notification';
import { compareColour } from '../lib/fit_status';

// After "Compare models": a row for each model's fit, in the colour it is drawn in on the image,
// to take one (undoable) or none. Esc also gives up (keyboard.js).
export default Backbone.View.extend({

    className: 'FitCompare',

    events: {
        'click .FitCompare__Use': 'use',
        'click .FitCompare__Cancel': 'cancel'
    },

    initialize: function ({app}) {
        this.app = app;
        $('body').append(this.$el);
        this.listenTo(app, 'change:fitCompare', this.render);
        this.render();
    },

    render: function () {
        const compare = this.app.get('fitCompare');
        this.$el.toggle(!!compare).empty();
        if (!compare) {
            return this;
        }
        this.$el.append($('<div class="FitCompare__Title">').text('Compare fits'));
        compare.results.forEach((result, i) => {
            const $row = $('<div class="FitCompare__Row">');
            $row.append(
                $('<span class="FitCompare__Swatch">').css('background', compareColour(i)),
                $('<span class="FitCompare__Name">').text(result.model),
                $('<span class="FitCompare__Moved">').text(`moves ${result.moved}`),
                $('<button class="Button-Info FitCompare__Use">').text('Use')
                    .attr('data-model', result.model));
            this.$el.append($row);
        });
        compare.failed.forEach((f) => {
            this.$el.append($('<div class="FitCompare__Failed">')
                .text(`${f.model}: ${f.message}`));
        });
        this.$el.append($('<button class="Button-Basic FitCompare__Cancel">')
            .text('Keep the landmarks (Esc)'));
        return this;
    },

    use: function (evt) {
        this.app.useFit($(evt.currentTarget).attr('data-model')).then(
            (moved) => notify({type: 'success',
                               msg: `Refined ${moved} landmarks (undo with z)`}),
            (message) => notify({type: 'error', msg: message}));
    },

    cancel: function () {
        this.app.endCompare();
    }
});
