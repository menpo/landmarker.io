import * as React from "react"
import { LandmarkGroupList, LandmarkGroupListProps } from './LandmarkGroupList'

export interface SidebarProps extends LandmarkGroupListProps {
    onClickLandmark: (index: number) => void
}

export const Sidebar:React.StatelessComponent<SidebarProps> = (props) =>
    <LandmarkGroupList
        groups={props.groups}
        onClick={props.onClickLandmark}
    />
