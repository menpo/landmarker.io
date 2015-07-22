'use strict';

export const ie = (function () {
    return /MSIE (\d+\.\d+);/.test(navigator.userAgent) ||
        !!navigator.userAgent.match(/Trident.*rv[ :]*11\./);
})();

export const webgl = (function () {
    try {
        var canvas = document.createElement('canvas');
        return !!(
            window.WebGLRenderingContext &&
            (canvas.getContext('webgl') ||
            canvas.getContext('experimental-webgl'))
            );
    } catch (e) {
        return false;
    }
})();

export const localstorage = (function () {
    try {
        localStorage.setItem('TEST_LS', 'TEST_LS');
        localStorage.removeItem('TEST_LS');
        return true;
    } catch (e) {
        console.log(`Couldn't find localStorage`);
        return false;
    }
})();

export const https = (function () {
    return window.location.protocol.indexOf('https') > -1;
})();

export default {
    ie,
    webgl,
    localstorage,
    https
};
