var Promise = require('promise-polyfill');

var XMLHttpRequestPromise = function (responseType, url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    // Return a new promise.
    var promise = new Promise(function(resolve, reject) {
        // Do the usual XHR stuff
        xhr.responseType = responseType;
        if(url.indexOf('https://') == 0) {
            // if it's HTTPS request with credentials
            xhr.withCredentials = true;
        }

        xhr.onload = function() {
            // This is called even on 404 etc
            // so check the status
            if (xhr.status == 200) {
                    // Resolve the promise with the response text
                resolve(xhr.response);
            }
            else {
                // Otherwise reject with the status text
                // which will hopefully be a meaningful error
                reject(Error(xhr.statusText));
            }
        };

        // Handle network errors
        xhr.onerror = function() {
            reject(Error("Network Error"));
        };

        // Make the request
        xhr.send();
    });

    // for compatibility, want to be able to get access to the underlying
    // xhr so we can abort if needed at a later time.
    promise.xhr = function () {
        return xhr;
    };

    return promise;
};


exports.ArrayBufferPromise = function (url) {
    return XMLHttpRequestPromise('arraybuffer', url);
};

exports.JSONPromise = function (url) {
    return XMLHttpRequestPromise('json', url);
};


window.JSONPromise = exports.JSONPromise;
