import * as React from "react"
import { Toggle } from '../components/Toggle'
import { Slider } from '../components/Slider'

export interface ToolbarProps {
    isBoundingBoxOn: boolean
    isConnectivityOn: boolean
    isTextureOn: boolean
    isSnapOn: boolean
    isAutosaveOn: boolean
    boundingBoxToggleEnabled: boolean
    textureToggleEnabled: boolean
    linksToggleEnabled: boolean
    snapToggleEnabled: boolean
    landmarkSizeSliderEnabled: boolean
    setBoundingBox: (isOn: boolean) => void
    setConnectivity: (isOn: boolean) => void
    setTexture: (isOn: boolean) => void
    setSnap: (isOn: boolean) => void
    setAutosave: (isOn: boolean) => void
    landmarkSize: number
    setLandmarkSize: (size: number) => void
}

export function Toolbar(props: ToolbarProps) {
    return (
        <div>
            { props.boundingBoxToggleEnabled ? <Toggle label="Bounding Box" checked={props.isBoundingBoxOn} disabled={false} onClick={props.setBoundingBox} /> : null}
            <Toggle label="Autosave" checked={props.isAutosaveOn} disabled={false} onClick={props.setAutosave} />
            <Toggle label="Links" checked={props.isConnectivityOn} disabled={!props.linksToggleEnabled} onClick={props.setConnectivity} />
            { props.textureToggleEnabled ? <Toggle label="Texture" checked={props.isTextureOn} disabled={false} onClick={props.setTexture} /> : null }
            <Toggle label="Snap" checked={props.isSnapOn} disabled={!props.snapToggleEnabled} onClick={props.setSnap} />
            <Slider label="●" min={0} max={100} value={props.landmarkSize} disabled={!props.landmarkSizeSliderEnabled} onChange={props.setLandmarkSize} />
        </div>
    )
}
