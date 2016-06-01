import * as React from 'react'
import * as ReactDom from 'react-dom'
import { Sidebar, SidebarProps } from './components/Sidebar'
import { App } from '../model/app'

const TEST_GROUPS = [
            {
                label: 'PATRICKS',
                landmarks: [
                    {
                        id: 0,
                        isEmpty: false,
                        isNextAvailable: false,
                        isSelected: true
                    },
                    {
                        id: 1,
                        isEmpty: true,
                        isNextAvailable: true,
                        isSelected: false
                    }
               ]
            },
            {
                label: 'FUUUUURCE',
                landmarks: [
                    {
                        id: 2,
                        isEmpty: false,
                        isNextAvailable: false,
                        isSelected: false
                    },
                    {
                        id: 3,
                        isEmpty: true,
                        isNextAvailable: false,
                        isSelected: false
                    },
                    {
                        id: 4,
                        isEmpty: true,
                        isNextAvailable: false,
                        isSelected: false
                    }
               ]
            }
        ]

export class ReactBridge {

    app: App

    constructor(app: App) {
        this.app = app
        app.on('change:landmarks', this.connectLandmarks)
        this.connectLandmarks()
    }

    connectLandmarks = () => {
        if (!this.app.landmarks) {
            return
        }
        this.app.landmarks.landmarks.forEach(lm => {
            lm.on('change', this.render)
        })
    }

    render = () => {
        if (!this.app.landmarks) {
            return
        }

        const groups = this.app.landmarks.labels.map(label => ({
            label: label.label,
            landmarks: label.landmarks.map(lm => ({
                id: lm.index,
                isEmpty: lm.isEmpty(),
                isNextAvailable: lm.isNextAvailable(),
                isSelected: lm.isSelected()
            }))
        }))

        const props: SidebarProps = {
            groups,
            onClickLandmark: (index: number) => { console.log(`landmark ${index} clicked!`)}
        }
        const sidebar = Sidebar(props)
        const el = document.getElementById('landmarksPanel')
        ReactDom.render(sidebar, el)

    }
}
