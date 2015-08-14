'use strict';

export default function Base () {
    throw new Error('Backend:Base class needs to be subclassed');
}

function thrower (name) {
    return function () { throw new Error(`${name} method not implemented`); };
}

/**
 * Returns which mode the backend is currently working on to set the viewport
 * accordingly
 *
 * @return {Promise}
 * @resolve {String}
 */
Base.prototype.fetchMode = thrower('fetchMode');

/**
 * List of available collections
 *
 * @return {Promise}
 * @resolve {String[]}
 */
Base.prototype.fetchCollections = thrower('fetchCollections');

/**
 * The list of assets ids in the collection with name collectionId,
 * these ids will be passed back as is to other methods such as fetchGeometry
 *
 * @param {String} collectionId
 * @return {Promise}
 * @resolve {String[]}
 */
Base.prototype.fetchCollection = thrower('fetchCollection');

/**
 * List of available templates, will be passed as is in fetchLandmarkGroup
 * and saveLandmarkGroup
 *
 * @return {Promise}
 * @resolve {String[]}
 */
Base.prototype.fetchTemplates = thrower('fetchTemplates');

/**
 * Return a thumbnail for the required assetId, have it reject if not available
 * for the current api
 *
 * @param {String} assetId
 * @return {Promise}
 * @resolve {THREE.Material}
 */
Base.prototype.fetchThumbnail = thrower('fetchThumbnail');

/**
 * Return the full texture for the required assetId
 * For images, the texture is the main data
 *
 * @param {String} assetId
 * @return {Promise}
 * @resolve {THREE.Material}
 */
Base.prototype.fetchTexture = thrower('fetchTexture');

/**
 * Return the 3d geometry for the required assetId, should take care of the
 * parsing and building the THREE object
 *
 * @param {String} assetId
 * @return {Promise}
 * @resolve {THREE.Geometry}
 */
Base.prototype.fetchGeometry = thrower('fetchGeometry');

/**
 * Return the remote data for landmarks for an asset/template combination
 *
 * @param {String} assetId
 * @param {String} type [template name]
 * @return {Promise}
 * @resolve {Object} [Parsed JSON]
 */
Base.prototype.fetchLandmarkGroup = thrower('fetchLandmarkGroup');

/**
 * Saves the json data remotely for landmarks for an asset/template combination,
 * resolving with any value marks success, rejection is an error
 *
 * @param {String} assetId
 * @param {String} type [template name]
 * @param {Object} json
 * @return {Promise}
 * @resolve {}
 */
Base.prototype.saveLandmarkGroup = thrower('saveLandmarkGroup');

/**
 * Inheritance helper
 * @param  {String} type [Used to identify backends in local storage]
 * @param  {Function} child
 * @return {Function}
 */
Base.extend = function extend (type, child) {
  child.prototype = Object.create(Base.prototype);
  child.prototype.constructor = child;
  child.Type = type;
  return child;
};
