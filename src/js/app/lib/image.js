var Promise = require('promise-polyfill');
var THREE = require('three');

module.exports = function (url) {

    return new Promise(function(resolve, reject) {

        var material = new THREE.MeshPhongMaterial(
            {
                map: THREE.ImageUtils.loadTexture(
                    url, new THREE.UVMapping(),
                    function () {
                        // the texture is now loaded, yield the material out
                        // of the promise
                        resolve(material);
                    },
                    reject
                )
            }
        );
    });
};
