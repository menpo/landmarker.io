import * as React from "react"
import { LandmarkProps } from './Landmark'
import { LandmarkList, LandmarkListProps } from './LandmarkList'

const S_GROUP: React.CSSProperties = {
        position: 'relative'
}

const S_LABEL: React.CSSProperties = {
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        zIndex: 1,
        pointerEvents: 'none',
        fontSize: 'larger',
        color: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        display: 'flex'
}

export interface LandmarkGroupProps extends LandmarkListProps {
    label: string
}

interface LandmarkGroupPropsWithCB extends LandmarkGroupProps {
    onClick: (index: number) => void
}

export function LandmarkGroup(props: LandmarkGroupPropsWithCB) {
    return (
        <div className="LmGroup" style={S_GROUP}>
            <div className="LmGroup-Label" style={S_LABEL}>{props.label}</div>
            <LandmarkList
                landmarks={props.landmarks}
                onClick={props.onClick} />
        </div>
    )
}
