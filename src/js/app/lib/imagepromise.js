'use strict';

import Promise from 'promise-polyfill';
import THREE from 'three';

import { loading } from '../view/notification';

export function ImagePromise (url, auth=false) {

    return new Promise(function (resolve, reject) {

        var xhr = new XMLHttpRequest();

        xhr.open('GET', url, true);
        xhr.responseType = 'blob';
        var img = new Image();

        xhr.withCredentials = !!auth;
        var asyncId = loading.start();

        xhr.addEventListener('load', function () {
            if (this.status === 200) {
                var blob = this.response;
                img.addEventListener('load', function () {
                    loading.stop(asyncId);
                    window.URL.revokeObjectURL(img.src); // Clean up after ourselves.
                    resolve(img);
                });
                img.src = window.URL.createObjectURL(blob);
            } else {
                loading.stop(asyncId);
                reject(Error(xhr.statusText));
            }
        });

        xhr.addEventListener('error', function() {
            loading.stop(asyncId);
            reject(Error('Network Error'));
        });

        xhr.addEventListener('abort', function() {
            loading.stop(asyncId);
            reject(Error('Aborted'));
        });

        xhr.send();
    });
}

export function TexturePromise (url, auth) {
    var texture = new THREE.Texture(undefined);
    texture.sourceFile = url;
    // in general our textures will not be powers of two size, so we need
    // to set our resampling appropriately.
    texture.minFilter = THREE.LinearFilter;

    return ImagePromise(url, auth).then(function(image) {
            texture.image = image;
            texture.needsUpdate = true;
            return texture;
    });
}

export function MaterialPromise (url, auth) {
    return TexturePromise(url, auth).then(function (texture) {
        return new THREE.MeshBasicMaterial({map: texture});
    });
}

export default MaterialPromise;
