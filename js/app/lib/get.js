module.exports = function (url) {
    var req = new XMLHttpRequest();
    req.open('GET', url);
    // Return a new promise.
    var promise = new Promise(function(resolve, reject) {
        // Do the usual XHR stuff
        req.responseType = 'arraybuffer';
        req.withCredentials = true;

        req.onload = function() {
            // This is called even on 404 etc
            // so check the status
            if (req.status == 200) {
                    // Resolve the promise with the response text
                resolve(req.response);
            }
            else {
                // Otherwise reject with the status text
                // which will hopefully be a meaningful error
                reject(Error(req.statusText));
            }
        };

        // Handle network errors
        req.onerror = function() {
            reject(Error("Network Error"));
        };

        // Make the request
        req.send();
    });

    // for compatibility, want to be able to get access to the underlying
    // xhr so we can abort if needed at a later time.
    promise.xhr = function () {
        return req;
    };

    return promise;
};
