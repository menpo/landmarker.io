"use strict";

module.exports.ie = (function () {
    return ( /MSIE (\d+\.\d+);/.test(navigator.userAgent) ||
             !!navigator.userAgent.match(/Trident.*rv[ :]*11\./) );
})();

module.exports.webgl = (function () {
    try {
        var canvas = document.createElement('canvas');
        return !! (
            window.WebGLRenderingContext &&
            ( canvas.getContext('webgl') ||
              canvas.getContext('experimental-webgl') )
        );
    } catch ( e ) {
        return false;
    }
})();

module.exports.localstorage = (function () {
    try {
        localStorage.setItem('TEST_LS', 'TEST_LS');
        localStorage.removeItem('TEST_LS');
        return true;
    } catch (e) {
        console.log("Couldn't find localStorage");
        return false;
    }
})();
