var Promise = require('promise-polyfill'),
    THREE = require('three');

var ImagePromise = function (url) {
    return new Promise(function (resolve, reject) {

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';
        var img = new Image();

        if(url.indexOf('https://') === 0) {
            // if it's HTTPS request with credentials
            xhr.withCredentials = true;
        }

        xhr.addEventListener('load', function () {
            if (this.status === 200) {
                var blob = this.response;
                img.addEventListener('load', function () {
                    window.URL.revokeObjectURL(img.src); // Clean up after ourselves.
                    resolve(img);
                });
                img.src = window.URL.createObjectURL(blob);
            } else {
                reject(Error(xhr.statusText));
            }
        });

        // Handle network errors
        xhr.addEventListener('error', function() {
            reject(Error("Network Error"));
        });

        xhr.send();
    });
};

var TexturePromise = function (url) {
    var texture = new THREE.Texture(undefined, new THREE.UVMapping());
    texture.sourceFile = url;

    return ImagePromise(url).then(function(image) {
            texture.image = image;
            texture.needsUpdate = true;
            return texture;
    });
};

var MaterialPromise = function(url) {
    return TexturePromise(url).then(function (texture) {
        return new THREE.MeshBasicMaterial({map: texture});
    });
};

module.exports = MaterialPromise;
