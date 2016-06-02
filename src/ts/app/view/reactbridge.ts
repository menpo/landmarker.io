import * as React from 'react'
import * as ReactDom from 'react-dom'
import { Sidebar, SidebarProps } from './components/Sidebar'
import { Toolbar, ToolbarProps } from './components/Toolbar'
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
        app.on('change:asset', this.connectAsset)
        app.on('change', this.renderToolbar)
        this.connectLandmarks()
        this.connectAsset()
        this.render()
        this.renderToolbar()
    }

    connectLandmarks = () => {
        if (!this.app.landmarks) {
            return
        }
        this.app.landmarks.landmarks.forEach(lm => {
            lm.on('change', this.render)
        })
    }

    connectAsset = () => {
        if (!this.app.asset()) {
            return
        }
        this.app.asset().on('change:textureOn', this.renderToolbar)
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

    renderToolbar = () => {
        const props: ToolbarProps = {
            isConnectivityOn: this.app.isConnectivityOn,
            isAutosaveOn: this.app.isAutoSaveOn,
            isSnapOn: this.app.isEditingOn,
            isTextureOn: this.app.asset() ? this.app.asset().isTextureOn() : false,
            setAutosave: (on) => this.app.toggleAutoSave(),
            setConnectivity: (on) => this.app.toggleConnectivity(),
            setSnap: (on) => this.app.toggleEditing(),
            setTexture: (on) => this.app.asset() ? this.app.asset().textureToggle() : null
        }
        const toolbar = Toolbar(props)
        const el = document.getElementById('toolbar')
        ReactDom.render(toolbar, el)
    }
}
