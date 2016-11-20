import * as React from "react"

function styleForButton(enabled: boolean) {
    const style: React.CSSProperties = {
        height: 30,
        // border: null,
        // background: 'white',
        // fontFamily: '"Roboto", Helvetica, Arial, sans-serif',
        // outline: null,
        // width: 100,
        // margin: 0,
        // minHeight: 40,
        // lineHeight: 40,
        // fontWeight: 'bold',
        // fontSize: 'large',
        // cursor: 'pointer',
    }
    if (!enabled) {
        style.opacity = 0.5
    }
    return style
}

export interface ButtonProps {
    label: string
    enabled: boolean
    onClick: () => void
}

export function Button(props: ButtonProps) {
    return (
        <button style={styleForButton(props.enabled)}
                onClick={() => props.enabled ? props.onClick() : null }>
            {props.label}
        </button>
    )
}
