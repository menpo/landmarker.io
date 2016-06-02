import * as React from "react"
import { Toggle } from '../components/Toggle'

export interface ToolbarProps {
    isConnectivityOn: boolean
    isTextureOn: boolean
    isSnapOn: boolean
    isAutosaveOn: boolean
    setConnectivity: (isOn: boolean) => void
    setTexture: (isOn: boolean) => void
    setSnap: (isOn: boolean) => void
    setAutosave: (isOn: boolean) => void
}

export const Toolbar:React.StatelessComponent<ToolbarProps> = (props) =>
    <div>
        <Toggle title="Links" checked={props.isConnectivityOn} onClick={props.setConnectivity} />
        <Toggle title="Texture" checked={props.isTextureOn} onClick={props.setTexture} />
        <Toggle title="Snap" checked={props.isSnapOn} onClick={props.setSnap} />
        <Toggle title="Autosave" checked={props.isAutosaveOn} onClick={props.setAutosave} />
    </div>
