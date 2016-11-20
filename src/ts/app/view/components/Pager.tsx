import * as React from "react"
import { Button, ButtonProps } from './Button'

interface PagerArrowProps {
    enabled: boolean
    onClick: () => void
    pointing: 'left' | 'right'
}

function PagerArrow(props: PagerArrowProps) {
    return (
        <Button onClick={props.onClick}
                label={props.pointing === 'left' ? '←' : '→' }
                enabled={props.enabled} />
    )
}


const style: React.CSSProperties = {
    display: 'flex',
    flex: 1
}


export interface PagerProps {
    decrementEnabled: boolean
    incrementEnabled: boolean
    onDecrement: () => void
    onIncrement: () => void,
}

export function Pager(props: PagerProps) {
    return (
        <div style={style}>
            <PagerArrow enabled={props.decrementEnabled} onClick={props.onDecrement} pointing='left'/>
            <PagerArrow enabled={props.incrementEnabled} onClick={props.onIncrement} pointing='right'/>
        </div>
    )
}
