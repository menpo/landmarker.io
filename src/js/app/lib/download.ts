'use strict';

import { loading } from '../view/notification';

export default function download (str, filename, type='json') {
    const spinner = loading.start();

    const previous = document.getElementById('localDownloadLink');
    if (previous) {
        previous.remove();
    }

    const data = `text/${type};charset=utf-8,${encodeURIComponent(str)}`;

    const link = document.createElement('a');
    link.setAttribute('style', 'display:none;');
    link.setAttribute('download', filename || `download.${type}`);
    link.setAttribute('href', `data:${data}`);
    link.setAttribute('id', `localDownloadLink`);
    link.setAttribute('hidden', `true`);

    // target="_blank" for Safari who still does not understand
    // the download attribute
    link.setAttribute('target', '_blank');

    // Add to DOM and click
    document.body.appendChild(link);
    document.getElementById('localDownloadLink').click();
    loading.stop(spinner);
}
