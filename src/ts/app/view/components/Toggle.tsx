import * as React from "react"

interface ToggleProps {
    label: string
    checked: boolean
    disabled: boolean
    onClick: (newCheckedState: boolean) => void
}

export function Toggle(props: ToggleProps) {
    return (
        <div className={ props.disabled ? "Toolbar-Row Toolbar-Row--Disabled" : "Toolbar-Row" } onClick={() => props.onClick(!props.checked)}>
            <div className="Toolbar-Row-Item">{props.label}</div>
            <div className="Toolbar-Row-Item">
                <div className="onoffswitch">
                    <input type="checkbox" checked={props.checked} name={`${props.label}Toggle`} className="onoffswitch-checkbox"/>
                    <label className="onoffswitch-label" htmlFor={`${props.label}Toggle`}>
                        <div className="onoffswitch-inner"></div>
                        <div className="onoffswitch-switch"></div>
                    </label>
                </div>
            </div>
        </div>
    )
}
