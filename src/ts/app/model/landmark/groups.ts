import { JSONLmPoint } from './landmark'
import { LandmarkGroupTracker, LandmarkGroup, landmarkGroupTrackerFactory } from './group'
import { Backend } from '../../backend'
import { notify } from '../../view/notification'

interface LJSON {
    groups: {
        [group: string]: {
            landmarks: {
                points: JSONLmPoint[],
                connectivity: [number, number][]
            },
            labels: {
                label: string,
                mask: number[]
            }[],
            metadata?: {
                [key: string]: any
            }
        }
    }
}

export interface LJSONFile extends LJSON {
    version: number
}

// LandmarkGroups is the container for all the landmark groups across multiple types/templates.
export class LandmarkGroups {

    groups: {[template: string]: LandmarkGroup}
    groupTrackers: {[template: string]: LandmarkGroupTracker}
    id: string
    backend: Backend

    constructor(json: LJSONFile, id: string, backend: Backend, trackers: {[template: string]: LandmarkGroupTracker}) {
        this.groupTrackers = trackers
        this.groups = {}
        for (let type in json.groups) {
            this.groups[type] = LandmarkGroup.parse(json.groups[type], id, type, backend,
                                                    this.landmarkGroupTrackerForAssetAndTemplate(type), this)
        }
        this.id = id
        this.backend = backend
    }

    landmarkGroupTrackerForAssetAndTemplate(template: string): LandmarkGroupTracker {
        const trackers = this.groupTrackers
        if (!trackers[template]) {
            trackers[template] = landmarkGroupTrackerFactory()
        }

        return trackers[template]
    }

    toJSON(): LJSONFile {
        const ljson = {
            groups: {},
            version: 3
        }
        for (let type in this.groups) {
            ljson.groups[type] = this.groups[type].toJSON()
        }
        return ljson
    }

    save(type: string) {
        return this.backend
            .saveLandmarkGroups(this.id, this.toJSON())
            .then(() => {
                this.groups[type].tracker.recordState(this.groups[type].toJSON(), true)
                notify({type: 'success', msg: 'Save Completed'})
            }, () => {
                notify({type: 'error', msg: 'Save Failed'})
            })
    }

}