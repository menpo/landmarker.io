'use strict';

import Backbone from 'backbone';

export default Backbone.View.extend({

    el: '#webcamOverlay',

    events: { click: 'close' },

    initialize: function() {
        console.log('building webcam');
        this.listenTo(this.model, 'change:webcamOverlayIsDisplayed', this.render);
        var video = document.querySelector('video');
        var canvas = document.getElementById('webcamCanvas');
        canvas.width = 1024;
        canvas.height = 1024;
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
        var constraints = {
            audio: false,
            video: {
                mandatory: {
                    minWidth: 1280,
                    minHeight: 720
                }
            }
        };
        // Not showing vendor prefixes or code that works cross-browser.
        navigator.webkitGetUserMedia(constraints, stream => {
            video.onloadedmetadata = function(){
                console.log(this.width + "x" + this.height);
                canvas.width = this.videoWidth;
                canvas.height = this.videoHeight;
            };
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
