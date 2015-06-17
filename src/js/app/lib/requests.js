"use strict";

var Promise = require('promise-polyfill'),
    QS = require('querystring');

var XMLHttpRequestPromise = function (
    responseType, url, headers, type='GET', data
) {
    var xhr = new XMLHttpRequest();
    xhr.open(type, url);
    // Return a new promise.
    var promise = new Promise(function(resolve, reject) {
        // Do the usual XHR stuff
        xhr.responseType = responseType;

        // if(url.indexOf('https://') === 0) {
        //     // if it's HTTPS request with credentials
        //     xhr.withCredentials = true;
        // }

        Object.keys(headers).forEach(function (key) {
            xhr.setRequestHeader(key, headers[key]);
        });

        xhr.onload = function() {
            // This is called even on 404 etc
            // so check the status
            if (xhr.status === 200) {
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


module.exports.ArrayBufferGetPromise = function (url, headers={}) {
    return XMLHttpRequestPromise('arraybuffer', url, headers);
};

module.exports.JSONGetPromise = function (url, headers={}) {
    return XMLHttpRequestPromise('json', url, headers);
};

module.exports.JSONPostPromise = function (url, data={}, headers={}) {
    headers["Content-type"] = "application/x-www-form-urlencoded";
    let params = QS.stringify(data);
    return XMLHttpRequestPromise('json', url, headers, 'POST', params);
}


var JSONPutPromise = function (url, json, headers={}) {
    xhr.open('PUT', url);
    // Return a new promise.
    var promise = new Promise(function(resolve, reject) {
        // Do the usual XHR stuff
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

        // if(url.indexOf('https://') === 0) {
        //     // if it's HTTPS request with credentials
        //     xhr.withCredentials = true;
        // }

        xhr.onload = function() {
            // This is called even on 404 etc
            // so check the status
            if (xhr.status === 200) {
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
        xhr.send(JSON.stringify(json));
    });

    // for compatibility, want to be able to get access to the underlying
    // xhr so we can abort if needed at a later time.
    promise.xhr = function () {
        return xhr;
    };

    return promise;
};

module.exports.JSONPutPromise = JSONPutPromise;
