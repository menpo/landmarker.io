import * as THREE from 'three'

export const touchListToArray = (touches: TouchList): Touch[] => {
    const result: Touch[] = []
    for (let i = 0; i < touches.length; i++) {
        result.push(touches[i])
    }
    return result
}

const stylusTouchIdentifiers = new Set<number>()

export const isStylusTouch = (touch: Touch): boolean => touch.force !== undefined && touch.force > 0

export type TouchByType = {
    finger: Touch[]
    stylus: Touch[]
}

export const touchListByType = (touches: TouchList): TouchByType => {
    const touchArray = touchListToArray(touches)
    return {
        stylus: touchArray.filter(isStylusTouch),
        finger: touchArray.filter((t => !isStylusTouch(t)))
    }
}

type PinchGap = {
    pinchGap: number
    pinchCenter: THREE.Vector2
}

export const touchToVector2 = (t: Touch): THREE.Vector2 => new THREE.Vector2(t.pageX, t.pageY)
export const touchToVector3 = (t: Touch): THREE.Vector3 => new THREE.Vector3(t.pageX, t.pageY, 0)


export const pinchGapAndCenter = (touchA: Touch, touchB: Touch): PinchGap =>  {
    const v1 = touchToVector2(touchA)
    const v2 = touchToVector2(touchB)

    const difference = new THREE.Vector2()
    const center = new THREE.Vector2()
    difference.subVectors(v1, v2)
    center.addVectors(v1, v2).divideScalar(2)
    return {
        pinchGap: difference.length(),
        pinchCenter: center
    }
}
