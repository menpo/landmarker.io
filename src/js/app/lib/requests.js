'use strict';

import Promise from 'promise-polyfill';
import querystring from 'querystring';

import { loading } from '../view/notification';

function _url(url, data) {
    if (!data || Object.keys(data).length === 0) {
        return url;
    } else {
        return `${url}?${querystring.stringify(data)}`;
    }
}

export default function XMLHttpRequestPromise(
    url, {
        method='GET',
        responseType,
        contentType,
        headers={},
        data,
        auth=false
    }
){
    var xhr = new XMLHttpRequest();
    xhr.open(method, url);
    // Return a new promise.
    var promise = new Promise(function(resolve, reject) {
        // Do the usual XHR stuff
        xhr.responseType = responseType || 'text';
        var asyncId = loading.start();

        xhr.withCredentials = !!auth;

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
            reject(new Error('Network Error'));
        };

        xhr.onabort = function () {
            loading.stop(asyncId);
            reject(new Error('Aborted'));
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
    promise.xhr = () => xhr;

    return promise;
}

export const Request = XMLHttpRequestPromise;

// Below are some shortcuts around the basic Request object for common
// network calls
export function getArrayBuffer (url, {headers={}, auth=false}={}) {
    return XMLHttpRequestPromise(
        url, {responseType: 'arraybuffer', headers, auth});
}

export function get (url, {headers={}, data={}, auth=false}={}) {
    return XMLHttpRequestPromise(
        _url(url, data), {headers, auth});
}

export function getJSON (url, {headers={}, data={}, auth=false}={}) {
    return XMLHttpRequestPromise(
        _url(url, data), {responseType: 'json', headers, auth});
}

export function putJSON (url, {headers={}, data={}, auth=false}={}) {
    return XMLHttpRequestPromise(url, {
        headers,
        auth,
        responseType: 'json',
        method: 'PUT',
        data: JSON.stringify(data),
        contentType: 'application/json;charset=UTF-8'
    });
}
