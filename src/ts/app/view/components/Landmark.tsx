import * as React from "react"
import * as classNames from 'classnames'
import * as _ from 'lodash'

const BASE_STYLE: React.CSSProperties = {
    flex: 1,
    height: 30,
    marginLeft: 1,
    marginBottom: 1,
    opacity: 0.5
}

function backgroundForState(isEmpty: boolean, isSelected: boolean, isNextAvailable: boolean):string  {
    if (isNextAvailable) {
        return 'orange'
    } else if (isSelected) {
        return 'purple'
    } else if (isEmpty) {
        return 'grey'
    } else {
        return 'blue'
    }
}

function style(props: LandmarkProps):React.CSSProperties  {
    return _.assign({
        background: backgroundForState(props.isEmpty, props.isSelected, props.isNextAvailable)
    }, BASE_STYLE)
}

export interface LandmarkProps {
    id: number
    isEmpty: boolean
    isSelected: boolean
    isNextAvailable: boolean
}

interface LandmarkPropsWithCB extends LandmarkProps {
    onClick: (index: number) => void
}

export const Landmark:React.StatelessComponent<LandmarkPropsWithCB> = (props) =>
    <div style={style(props)} onClick={() => props.onClick(props.id)}></div>
