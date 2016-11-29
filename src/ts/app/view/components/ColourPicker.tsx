import * as React from "react"
import { TwitterPicker } from 'react-color'

interface ColourPickerProps {
    label: string
    triangle: string
    width: string
    colours: string[]
    landmarkColour: string
    setLandmarkColour: (colour, event) => void
}

export function ColourPicker(props: ColourPickerProps) {
    return (
        <div>
            <div className="Toolbar-Row">
                <div className="Toolbar-Row-Item">{props.label}</div>
            </div>
            <div className="Toolbar-Row">
                <div className="Toolbar-Row-Item">
                    <TwitterPicker triangle={props.triangle} width={props.width} colors={props.colours}
                    color={props.landmarkColour} onChange={props.setLandmarkColour} />
                </div>
            </div>
        </div>
    )
}