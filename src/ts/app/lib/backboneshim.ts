import * as _ from 'underscore'
import * as Backbone from 'backbone'

// Backbone Events is an object, not a class, so we can't
// extend it, which would be the Typescript-y thing to do.
// This shim class simply declares a class with the same
// definition as Backbone.Event that does the binding to
// the event object in its construtor.
export class EventsClass {

    constructor() {
        // extend backbone events...
        _.extend(this, Backbone.Events)
    }

    // ...and manually promise the same API as Backbone Events for typing checks.
    on: ((eventName: string, callback?: Function, context?: any) => any)
    off: (eventName?: string, callback?: Function, context?: any) => any
    trigger: (eventName: string, ...args: any[]) => any
    bind: (eventName: string, callback: Function, context?: any) => any
    unbind: (eventName?: string, callback?: Function, context?: any) => any

    once: (events: string, callback: Function, context?: any) => any
    listenTo: (object: any, events: string, callback: Function) => any
    listenToOnce: (object: any, events: string, callback: Function) =>  any
    stopListening: (object?: any, events?: string, callback?: Function) => any
}
