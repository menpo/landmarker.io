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
            <div className="onoffswitch">
                <input type="checkbox" checked={props.checked} name={`${props.title}Toggle`} className="onoffswitch-checkbox"/>
                <label className="onoffswitch-label" for={`${props.title}Toggle`}>
                    <div className="onoffswitch-inner"></div>
                    <div className="onoffswitch-switch"></div>
                </label>
            </div>
        </div>
    </div>
