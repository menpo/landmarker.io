'use strict';

import Backbone from 'backbone';
import $ from 'jquery';

export default Backbone.View.extend({

    el: '#webcamOverlay',

    events: { click: 'close' },

    initialize: function() {
        this.listenTo(this.model, 'change:webcamOverlayIsDisplayed', this.render);
        var video = document.querySelector('video');
        var canvas = document.getElementById('webcamCanvas');
        var ctx = canvas.getContext('2d');
        var localMediaStream = null;
        var thatModel = this.model;
        video.addEventListener('click', () => {
            if (localMediaStream) {
                ctx.drawImage(video, 0, 0);
                thatModel.server().saveImage(`t_${Date.now()}`, canvas.toDataURL('image/png'))
                    .then(() => {
                        thatModel.reloadAssetSource(true);
                    });
            }
        }, false);

        // Not showing vendor prefixes or code that works cross-browser.
        navigator.webkitGetUserMedia({video: true}, stream => {
            video.src = window.URL.createObjectURL(stream);
            localMediaStream = stream;
        }, (e) => console.log(e));
        this.render();
    },

    render: function () {
        this.$el.toggleClass('Display', this.model.isWebcamOverlayOn());
    },

    close: function () {
        this.model.toggleWebcamOverlay();
    }
});
