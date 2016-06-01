import * as React from "react"

interface ToggleProps {
    title: string
    checked: boolean
    onClick: (newCheckedState: boolean) => void
}

export const Toggle:React.StatelessComponent<ToggleProps> = (props) =>
    <div className="Toolbar-Row" onClick={() => props.onClick(!props.checked)}>
        <div className="Toolbar-Row-Item">{props.title}</div>
        <div className="Toolbar-Row-Item">
            <p>{ props.checked ? 'ON' : 'OFF' }</p>
        </div>
    </div>
