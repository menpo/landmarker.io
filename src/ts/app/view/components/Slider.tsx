import * as React from "react"

type ChangeFunction = (newNumber: number) => void

interface SliderProps {
    label: string,
    min: number,
    max: number
    value: number
    onChange: ChangeFunction
}

// Invokes callback with value from React's SyntheticEvent event safely
const bind = (onChange: ChangeFunction) => (event: React.SyntheticEvent) => {
    const target = event.target as HTMLInputElement
    onChange(parseInt(target.value))
}

export const Slider:React.StatelessComponent<SliderProps> = (props) =>
    <div className="Toolbar-Row Toolbar-Slider">
        <div>{props.label}</div>
        <input type="range" onChange={bind(props.onChange)} min={props.min} max={props.max} value={props.value}/>
    </div>
