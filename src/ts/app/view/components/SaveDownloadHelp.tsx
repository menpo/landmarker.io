import * as React from "react"
import { Button, ButtonProps } from './Button'

export interface SaveDownloadHelpProps {
    hasUnsavedChanges: boolean
    onSave: () => any
    onDownload: () => any
    onOpenHelp: () => any
}

export function SaveDownloadHelp(props: SaveDownloadHelpProps) {
    return (
        <div>
            <Button label="Save" enabled={true} onClick={props.onSave} />
            <Button label="Download" enabled={true} onClick={props.onDownload} />
            <Button label="Help" enabled={true} onClick={props.onOpenHelp} />
        </div>
    )
}
