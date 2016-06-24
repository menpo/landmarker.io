/**
 * Persistable config object with get and set logic
 * Requires localstorage to work properly (throws Error otherwise),
 * serialisation is simple JSON
 */
import * as _ from 'underscore'

import * as support from '../lib/support'

const LOCALSTORAGE_KEY = 'LMIO#CONFIG'

export class Config {
    _data = {}

    get(key:string) {
        if (!key) {
            return _.clone(this._data)
        } else {
            return this._data[key]
        }
    }

    has(key: string) {
        return this._data.hasOwnProperty(key)
    }

    delete(key: string, save: boolean) {
        delete this._data[key]
        if (save) {
            this.save()
        }
    }

    set(arg1: string | {}, arg2: {} | boolean, arg3: boolean) {

        let save: boolean

        if (typeof arg1 === 'string') { // Submitted a key/value pair
            this._data[arg1] = arg2
            save = !!arg3
        } else if (typeof arg1 === 'object') { // Submitted a set of pairs
            Object.keys(arg1).forEach((k) => {
                this._data[k] = arg1[k]
            })
            save = !!arg2
        }

        if (save) {
            this.save()
        }
    }

    save() {
        if (support.localstorage) {
            localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(this._data))
        }
    }

    load() {
        if (support.localstorage) {
            const data = localStorage.getItem(LOCALSTORAGE_KEY)
            if (data) {
                this._data = JSON.parse(data)
            } else {
                this._data = {}
            }
        }
    }

    clear() {
        if (support.localstorage) {
            localStorage.removeItem(LOCALSTORAGE_KEY)
        }
        this._data = {}
    }

}

let _configInstance: Config

export default function () {
    if (!_configInstance) {
        _configInstance = new Config()
    }
    return _configInstance
}
