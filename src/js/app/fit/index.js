'use strict';

import Promise from 'promise-polyfill';

import * as request from '../lib/requests';
import * as _u from '../lib/utils';

export default function Fitter (url) {
    this.types = [];
    this.url = _u.prependHttp(url);
}

Fitter.prototype.initialize = function () {
    return request.getJSON(this.url).then((types) => {
        this.types = types;
        return true;
    });
};

Fitter.prototype.uid = function (type, id) {
    const uid = this.uids[[type, id]];
    if (!uid) {
        throw new ReferenceError(`Fitting not started for ${type}:${id}`);
    } else {
        return uid;
    }
};

Fitter.prototype.hasType = function (type) {
    return this.types.indexOf(type) > -1;
};

Fitter.prototype.fit = function (type, img, lms=null) {
    const data = {
        'img_data': _u.imgToDataUrl(img)
    };
    if (lms !== null) {
        data.landmarks = JSON.stringify(lms);
    }
    return request.putJSON(`${this.url}/${type}`, { data: data });
};

Fitter.prototype.update = function (type, id, lms) {
    if (!lms) {
        return Promise.reject(null);
    } else {
        return this.fit(type, id, lms, true);
    }

};
