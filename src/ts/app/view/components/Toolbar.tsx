import * as React from "react"
import { Toggle } from '../components/Toggle'
import { Slider } from '../components/Slider'

export interface ToolbarProps {
    isConnectivityOn: boolean
    isTextureOn: boolean
    isSnapOn: boolean
    isAutosaveOn: boolean
    setConnectivity: (isOn: boolean) => void
    setTexture: (isOn: boolean) => void
    setSnap: (isOn: boolean) => void
    setAutosave: (isOn: boolean) => void
    landmarkSize: number,
    setLandmarkSize: (size: number) => void
}

export function Toolbar(props: ToolbarProps) {
    return (
        <div>
            <Toggle label="Autosave" checked={props.isAutosaveOn} onClick={props.setAutosave} />
            <Toggle label="Links" checked={props.isConnectivityOn} onClick={props.setConnectivity} />
            <Toggle label="Texture" checked={props.isTextureOn} onClick={props.setTexture} />
            <Toggle label="Snap" checked={props.isSnapOn} onClick={props.setSnap} />
            <Slider label="●" min={0} max={100} value={props.landmarkSize} onChange={props.setLandmarkSize} />
        </div>
    )
}
