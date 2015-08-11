'use strict';

import Promise from 'promise-polyfill';

import * as request from '../lib/requests';
import * as _u from '../lib/utils';

export default function Fitter (url) {
    this.uids = {};
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

Fitter.prototype.hasAsset = function (type, id) {
    return !!this.uids[[type, id]];
};

Fitter.prototype.init = function (type, id, img, lms=null) {
    console.time(`FittingTime:${id}`);
    const imgData = _u.imgToDataUrl(img);
    return request.post(`${this.url}/${type}/new`, {
        data: {
            'img_data': imgData,
            landmarks: JSON.stringify(lms)
        }
    }).then((res) => {
        console.timeEnd(`FittingTime:${id}`);
        this.uids[[type, id]] = res.uid;
        return res;
    });
};

Fitter.prototype.fit = function (type, id, lms=null, update=false) {
    const uid = this.uids[[type, id]];
    if (uid) {
        return request.post(`${this.url}/${type}/${uid}`, {
            data: { landmarks: JSON.stringify(lms), update }
        });
    }
};

Fitter.prototype.update = function (type, id, lms) {
    if (!lms) {
        return Promise.reject(null);
    } else {
        return this.fit(type, id, lms, true);
    }

};
