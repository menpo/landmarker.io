'use strict';

// What the Fit panel shows and allows, from the server's status (GET /fit). No DOM here.

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Returns {lines, busy, jobLine, error, fit, box, predict, learn, train}, where each action is
// {enabled, reason} (the reason is a tooltip: what is missing)
// `saved`: the landmarks on the screen are the ones in the file (nothing unsaved)
export function fitPanelState (status, {hasLandmarks=true, saved=true}={}) {
    const job = status.job || null;
    const busy = !!job && job.state === 'running';
    const learns = status.can_increment || status.can_build;
    const ready = !!status.ready;

    const lines = [];
    lines.push(`Model: ${status.model}`);
    if (ready) {
        lines.push(!learns ? 'Fixed model (it does not learn)' :
                   status.has_initial_state ?
                       `Pretrained, plus ${plural(status.trained_on, 'image')} of yours` :
                       `Learnt from ${plural(status.trained_on, 'image')}`);
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
    const proposals = status.proposals || 0;
    if (proposals) {
        lines.push(`${plural(proposals, 'proposal')} waiting to be checked and saved`);
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
        // the model learns only from what is saved, never from the screen
        learn: action(ready && !!status.can_increment && saved,
                      !status.can_increment ? 'This model cannot learn one image at a time' :
                      !ready ? 'Not ready' : 'Save this image first (ctrl+s)'),
        canSwitchLearnOnSave: !!status.can_increment,
        learnOnSave: !!status.learn_on_save,
        train: action(learns && status.annotated > 0,
                      learns ? 'There are no annotations to learn from' :
                               'This model cannot be trained'),
        unlabelled: status.unlabelled,
        proposals,
        // what a pre-fit would do now (it skips the images that already have a proposal)
        prefitCount: Math.max(0, (status.unlabelled || 0) - proposals),
        annotated: status.annotated,
        canStartFromCurrent: hasLandmarks
    };
}

// How a model shows in the list: {text, kind} with kind one of busy, error, ready, fixed, empty
export function modelChip (status) {
    const job = status.job || null;
    if (job && job.state === 'running') {
        return {kind: 'busy', text: `${job.kind} ${job.done}/${job.total}`};
    }
    if (status.error || (job && job.state === 'error')) {
        return {kind: 'error', text: 'error'};
    }
    const learns = status.can_increment || status.can_build;
    if (!status.ready) {
        return learns ? {kind: 'empty',
                         text: `needs ${status.min_images} images (${status.annotated})`} :
                        {kind: 'empty', text: 'no state'};
    }
    if (learns && status.has_initial_state) {
        return {kind: 'ready', text: status.trained_on ? `pretrained + ${status.trained_on}` : 'pretrained'};
    }
    return learns ? {kind: 'ready', text: `learnt from ${status.trained_on}`} :
                    {kind: 'fixed', text: 'pretrained'};
}

// The server may have any number of models (status.models, by name, the first is the default
// one) or, an older one, a single one (the status itself).
//   active: the name the annotator chose; the default model if there is no such model
// Returns {models: [{name, chip, isActive, isDefault, ready, status}], active, panel, compare}
// where `panel` is fitPanelState of the active model and `compare` {enabled, reason, names}
export function modelsState (status, {hasLandmarks=true, saved=true, active=null}={}) {
    const byName = status.models || {[status.name || status.model]: status};
    const names = Object.keys(byName);
    const defaultName = status.default || names[0];
    const chosen = byName[active] ? active : defaultName;
    const models = names.map(name => ({
        name,
        chip: modelChip(byName[name]),
        isActive: name === chosen,
        isDefault: name === defaultName,
        ready: !!byName[name].ready,
        status: byName[name]
    }));
    const ready = models.filter(m => m.ready).map(m => m.name);
    return {
        models,
        active: chosen,
        panel: fitPanelState(byName[chosen], {hasLandmarks, saved}),
        compare: {
            enabled: ready.length > 1 && hasLandmarks,
            reason: ready.length < 2 ? 'Needs two models that are ready' : 'No landmarks here',
            names: ready
        }
    };
}

// The colour of the i-th model in a comparison, for its overlay and its row in the panel
const COMPARE_COLOURS = ['#01e6fb', '#ff9f1c', '#e71d36', '#2ec4b6', '#b07cff', '#ffd23f'];
export const compareColour = (i) => COMPARE_COLOURS[i % COMPARE_COLOURS.length];
