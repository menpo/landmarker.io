import * as React from "react"
import { Button, ButtonProps } from './Button'

export interface UndoRedoProps {
    canUndo: boolean
    canRedo: boolean
    undo: () => any
    redo: () => any
}

export function UndoRedo(props: UndoRedoProps) {
    return (
        <div>
            <Button label="←" enabled={props.canUndo} onClick={props.undo} />
            <Button label="→" enabled={props.canRedo} onClick={props.redo} />
        </div>
    )
}
