import * as React from 'react'
import * as ReactDom from 'react-dom'
import { Sidebar, SidebarProps } from './components/Sidebar'
import { Toolbar, ToolbarProps } from './components/Toolbar'
import { Pager, PagerProps } from './components/Pager'
import { App } from '../model/app'

export class ReactBridge {

    app: App

    constructor(app: App) {
        this.app = app
        app.on('change:landmarks', () => this.connectLandmarks())
        app.on('change:asset', () => this.connectAsset())
        app.on('change', () => {
            this.renderToolbar()
        })
        app.on('change:asset', () => this.renderPager())

        this.connectLandmarks()
        this.connectAsset()
        this.renderLandmarkTable()
        this.renderToolbar()
        this.renderPager()
    }

    connectLandmarks() {
        if (!this.app.landmarks) {
            return
        }
        this.app.landmarks.landmarks.forEach(lm => {
            lm.on('change', () => this.renderLandmarkTable())
        })
        this.renderLandmarkTable()
    }

    connectAsset() {
        if (!this.app.asset()) {
            return
        }
        this.app.asset().on('change:textureOn', () => this.renderToolbar())
    }

    renderLandmarkTable() {
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

    renderToolbar() {
        const props: ToolbarProps = {
            isConnectivityOn: this.app.isConnectivityOn,
            isAutosaveOn: this.app.isAutoSaveOn,
            isSnapOn: this.app.isEditingOn,
            isTextureOn: this.app.asset() ? this.app.asset().isTextureOn() : false,
            textureToggleEnabled: this.app.meshMode(),
            setAutosave: (on) => this.app.toggleAutoSave(),
            setConnectivity: (on) => this.app.toggleConnectivity(),
            setSnap: (on) => this.app.toggleEditing(),
            setTexture: (on) => this.app.asset() ? this.app.asset().textureToggle() : null,
            landmarkSize: this.app.landmarkSize * 100,
            setLandmarkSize: (size) => { this.app.landmarkSize = size / 100 },
            landmarkColour: this.app.landmarkColour,
            setLandmarkColour: (colour, event) => { this.app.landmarkColour = colour.hex }
        }
        const toolbar = Toolbar(props)
        const el = document.getElementById('toolbar')
        ReactDom.render(toolbar, el)
    }

    renderPager() {
        if (!this.app.assetSource) {
            return
        }
        const props: PagerProps = {
            decrementEnabled: this.app.assetSource.hasPredecessor,
            incrementEnabled: this.app.assetSource.hasSuccessor,
            onDecrement: () => this.app.previousAsset(),
            onIncrement: () => this.app.nextAsset()
        }
        const pager = Pager(props)
        const el = document.getElementById('assetPager')
        ReactDom.render(pager, el)
    }
}
