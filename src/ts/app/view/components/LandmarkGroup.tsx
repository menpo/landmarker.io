import * as React from "react"
import { LandmarkProps } from './Landmark'
import { LandmarkList, LandmarkListProps } from './LandmarkList'

const S = {
    GROUP: {
        position: 'relative'
    },
    LABEL: {
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
}

export interface LandmarkGroupProps extends LandmarkListProps {
    label: string
}

interface LandmarkGroupPropsWithCB extends LandmarkGroupProps {
    onClick: (index: number) => void
}

export const LandmarkGroup:React.StatelessComponent<LandmarkGroupPropsWithCB> = (props) =>
    <div className="LmGroup" style={S.GROUP}>
        <div className="LmGroup-Label" style={S.LABEL}>{props.label}</div>
        <LandmarkList
            landmarks={props.landmarks}
            onClick={props.onClick} />
    </div>
