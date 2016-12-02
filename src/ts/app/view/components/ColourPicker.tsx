import * as React from "react"
import { TwitterPicker } from 'react-color'

interface ColourPickerProps {
    label: string
    colour: string
    setColour: (colour, event) => void
}

export function ColourPicker(props: ColourPickerProps) {
    return (
        <div>
            <div className="Toolbar-Row">
                <div className="Toolbar-Row-Item">{props.label}</div>
            </div>
            <div className="Toolbar-Row">
                <div className="Toolbar-Row-Item">
                    <TwitterPicker triangle="hide" width="172px"
                    colors={['#FF6900', '#FFFF00', '#00D084', '#8ED1FC', '#0693E3', '#EB144C', '#FF75FF', '#9900EF']}
                    color={props.colour} onChange={props.setColour} />
                </div>
            </div>
        </div>
    )
}