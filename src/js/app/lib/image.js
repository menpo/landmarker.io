var Promise = require('promise-polyfill');
var THREE = require('three');


window.ImagePromise = function (url) {
    return new Promise(function(resolve, reject) {
        var img = new Image;
        img.crossOrigin = '';
        img.addEventListener('load', function (event) {
            resolve(img);
        });
        img.addEventListener('error', function (event) {
            reject(event);
        });
        img.src = url;
    });
};

window.TexturePromise = function (url) {
    var texture = new THREE.Texture(undefined, new THREE.UVMapping());
    texture.sourceFile = url;

    return ImagePromise(url).then(function(image) {
            texture.image = image;
            texture.needsUpdate = true;
            return texture;
    });
};

window.MaterialPromise = function(url) {
    return TexturePromise(url).then(function (texture) {
        return new THREE.MeshBasicMaterial({map: texture});
    });
};

module.exports = MaterialPromise;
