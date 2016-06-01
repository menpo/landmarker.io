import * as React from "react"
import { LandmarkProps } from './Landmark'
import { LandmarkGroup, LandmarkGroupProps } from './LandmarkGroup'

export interface LandmarkGroupListProps {
    groups: LandmarkGroupProps[]
}

interface LandmarkGroupListPropsWithCB extends LandmarkGroupListProps {
    onClick: (index: number) => void
}

export const LandmarkGroupList:React.StatelessComponent<LandmarkGroupListPropsWithCB> = (props) =>
    <div>
        {props.groups.map((group, i) =>
                <LandmarkGroup {...group}
                    key={i}
                    onClick={props.onClick} />
        )}
    </div>
