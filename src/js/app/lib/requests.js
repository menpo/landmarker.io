"use strict";

var Promise = require('promise-polyfill'),
    QS = require('querystring');

var { loading } = require('../view/notification');

function XMLHttpRequestPromise(
    url, {method='GET', responseType, contentType, headers, data}
){
    var xhr = new XMLHttpRequest();
    xhr.open(method, url);
    // Return a new promise.
    var promise = new Promise(function(resolve, reject) {
        // Do the usual XHR stuff
        xhr.responseType = responseType || 'text';
        var asyncId = loading.start();

        Object.keys(headers).forEach(function (key) {
            xhr.setRequestHeader(key, headers[key]);
        });

        if (contentType) {
            xhr.setRequestHeader('Content-Type', contentType);
        }

        xhr.onload = function() {
            // This is called even on 404 etc
            // so check the status
            loading.stop(asyncId);
            if ((xhr.status / 100 || 0) === 2) {
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
        xhr.onerror = function () {
            loading.stop(asyncId);
            console.log('UNLOADING', asyncId);
            reject(new Error("Network Error"));
        };

        xhr.onabort = function () {
            loading.stop(asyncId);
            reject(new Error("Aborted"));
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
}

module.exports.Request = XMLHttpRequestPromise;

module.exports.getArrayBuffer = function (url, headers={}) {
    return XMLHttpRequestPromise(url, {responseType: 'arraybuffer', headers});
};

module.exports.get = function (url, headers={}, data={}) {
    if (data) {
        url = `${url}?${QS.stringify(data)}`;
    }
    return XMLHttpRequestPromise(url, {headers});
}

module.exports.getJSON = function (url, headers={}, data=undefined) {
    if (data) {
        url = `${url}?${QS.stringify(data)}`;
    }
    return XMLHttpRequestPromise(url, {responseType: 'json', headers});
};

module.exports.postJSON = function (url, data={}, headers={}) {
    return XMLHttpRequestPromise(url, {
        headers,
        responseType: 'json',
        method: 'POST',
        data: QS.stringify(data),
        contentType: "application/x-www-form-urlencoded"
    });
}

module.exports.putJSON = function (url, data={}, headers={}) {
    return XMLHttpRequestPromise(url, {
        headers,
        responseType: 'json',
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: "application/json;charset=UTF-8"
    });
}
