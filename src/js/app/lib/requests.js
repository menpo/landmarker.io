"use strict";

var Promise = require('promise-polyfill'),
    QS = require('querystring');

function XMLHttpRequestPromise(
    url, {method, responseType, contentType, headers, data}
){
    var xhr = new XMLHttpRequest();
    xhr.open(method || 'GET', url);
    // Return a new promise.
    var promise = new Promise(function(resolve, reject) {
        // Do the usual XHR stuff
        xhr.responseType = responseType || 'json';

        Object.keys(headers).forEach(function (key) {
            xhr.setRequestHeader(key, headers[key]);
        });

        if (contentType) {
            xhr.setRequestHeader('Content-Type', contentType);
        }

        xhr.onload = function() {
            // This is called even on 404 etc
            // so check the status
            if ((xhr.status / 100 | 0) === 2) {
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
        if (data) {
            xhr.send(data);
        } else {
            xhr.send();
        }
    });

    // for compatibility, want to be able to get access to the underlying
    // xhr so we can abort if needed at a later time.
    promise.xhr = function () {
        return xhr;
    };

    return promise;
};

module.exports.XMLHttpRequestPromise = XMLHttpRequestPromise;

module.exports.ArrayBufferGetPromise = function (url, headers={}) {
    return XMLHttpRequestPromise(url, {responseType: 'arraybuffer', headers});
};

module.exports.JSONGetPromise = function (url, headers={}, data) {
    if (data) {
        url = `${url}?${QS.stringify(data)}`;
    }
    return XMLHttpRequestPromise(url, {headers});
};

module.exports.JSONPostPromise = function (url, data={}, headers={}) {
    return XMLHttpRequestPromise(url, {
        headers,
        method: 'POST',
        data: QS.stringify(data),
        contentType: "application/x-www-form-urlencoded"
    });
}

module.exports.JSONPutPromise = function (url, data={}, headers={}) {
    return XMLHttpRequestPromise(url, {
        headers,
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: "application/json;charset=UTF-8"
    });
}
