import * as React from "react"
import { LandmarkGroupList, LandmarkGroupListProps } from './LandmarkGroupList'

export interface SidebarProps extends LandmarkGroupListProps {
    onClickLandmark: (index: number) => void
}

export function Sidebar(props: SidebarProps) {
    return (
        <LandmarkGroupList
            groups={props.groups}
            onClick={props.onClickLandmark}
        />
    )
}
