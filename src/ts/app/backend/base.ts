import { LJSONFile } from '../model/landmark'

export interface Backend {

    /**
     * Returns which mode the backend is currently working on to set the viewport
     * accordingly
     */
     fetchMode(): Promise<'image' | 'mesh'>

    /**
     * List of available collections
     *
     * @return {Promise}
     * @resolve {String[]}
     */
    fetchCollections(): Promise<string[]>

    /**
     * The list of assets ids in the collection with name collectionId,
     * these ids will be passed back as is to other methods such as fetchGeometry
     *
     * @param {String} collectionId
     * @return {Promise}
     * @resolve {String[]}
     */
    fetchCollection(collectionId: string): Promise<string[]>

    /**
     * List of available templates, will be passed as is in fetchLandmarkGroup
     * and saveLandmarkGroup
     *
     * @return {Promise}
     * @resolve {String[]}
     */
    fetchTemplates(): Promise<string[]>

    /**
     * Return a thumbnail for the required assetId, have it reject if not available
     * for the current api
     *
     * @param {String} assetId
     * @return {Promise}
     * @resolve {THREE.Material}
     */
    fetchThumbnail(assetId:string): Promise<THREE.Material>

    /**
     * Return the full texture for the required assetId
     * For images, the texture is the main data
     *
     * @param {String} assetId
     * @return {Promise}
     * @resolve {THREE.Material}
     */
    fetchTexture(assetId: string): Promise<THREE.Material>

    /**
     * Return the 3d geometry for the required assetId, should take care of the
     * parsing and building the THREE object
     *
     * @param {String} assetId
     * @return {Promise}
     * @resolve {THREE.Geometry}
     */
    fetchGeometry(assetId: string): Promise<THREE.BufferGeometry>

    /**
     * Return the remote data for landmarks for an asset/template combination
     *
     * @param {String} assetId
     * @param {String} type [template name]
     * @return {Promise}
     * @resolve {Object} [Parsed JSON]
     */
    fetchLandmarkGroup(assetId: string, group:string): Promise<LJSONFile>

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
    saveLandmarkGroup(assetId: string, group:string, object:Object): Promise<{}>

}
