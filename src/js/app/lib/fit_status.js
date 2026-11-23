'use strict';

// What the Fit panel shows and allows, from the server's status (GET /fit). No DOM here.

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Returns {lines, busy, jobLine, error, fit, box, predict, train}, where each action is
// {enabled, reason} (the reason is a tooltip: what is missing)
export function fitPanelState (status, {hasLandmarks=true}={}) {
    const job = status.job || null;
    const busy = !!job && job.state === 'running';
    const learns = status.can_increment || status.can_build;
    const ready = !!status.ready;

    const lines = [];
    lines.push(`Model: ${status.model}`);
    if (ready) {
        lines.push(learns ? `Learnt from ${plural(status.trained_on, 'image')}` :
                            'Fixed model (it does not learn)');
    } else if (learns) {
        lines.push(`Not ready: needs ${status.min_images} annotated images ` +
                   `(${status.annotated} so far)`);
    } else {
        lines.push('Not ready: the model has no state');
    }
    if (status.can_increment) {
        lines.push(status.learn_on_save ?
            'Learns from each image you save' : 'Does not learn when you save');
    }

    let jobLine = null;
    if (job) {
        const progress = job.state === 'running' ?
            `${job.done} of ${job.total}` : (job.message || job.state);
        jobLine = `${job.kind}: ${job.state === 'running' ? 'running, ' : ''}${progress}`;
    }

    const action = (enabled, reason) => ({enabled: enabled && !busy,
                                           reason: busy ? 'Wait for the job' :
                                                   (enabled ? '' : reason)});
    return {
        lines,
        busy,
        jobLine,
        jobFailed: !!job && job.state === 'error',
        error: status.error || null,
        fit: action(ready && hasLandmarks, ready ? 'No landmarks here' : 'Not ready'),
        box: action(ready && hasLandmarks && !!status.can_initialize,
                    status.can_initialize ? 'Not ready' :
                        'This model cannot start from a box'),
        predict: action(ready && !!status.can_initialize && status.unlabelled > 0,
                        status.unlabelled > 0 ? 'Not ready or cannot start from nothing' :
                                                'Every image has landmarks'),
        train: action(learns && status.annotated > 0,
                      learns ? 'There are no annotations to learn from' :
                               'This model cannot be trained'),
        unlabelled: status.unlabelled,
        annotated: status.annotated,
        canStartFromCurrent: hasLandmarks
    };
}
