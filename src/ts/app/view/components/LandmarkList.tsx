import * as React from "react"
import { Landmark, LandmarkProps } from './Landmark'

const S: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: '100%',
}

export interface LandmarkListProps {
    landmarks: LandmarkProps[]
}

interface LandmarkListPropsWithCB extends LandmarkListProps {
    onClick: (index: number) => void
}

export function LandmarkList(props: LandmarkListPropsWithCB) {
    return (
        <div className="LandmarkList" style={S}>
            {props.landmarks.map((lm, index) =>
                    <Landmark {...lm}
                        key={index}
                        onClick={props.onClick} />
            )}
        </div>
    )
}
