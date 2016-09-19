export function listenOnce(element: EventTarget,
                           type: string,
                           listener: ((event: Event)=> void)): ((event: Event)=> void)  {

    const listenAndRemove = (event: Event): void => {
        element.removeEventListener(type, listenAndRemove, false)
        listener(event)
    }

    element.addEventListener(type, listenAndRemove, false)
    // return the listenAndRemove event in case the callee wishes to abort.
    return listenAndRemove
}
