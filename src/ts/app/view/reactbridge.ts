import * as React from 'react'
import * as ReactDom from 'react-dom'
import { Sidebar, SidebarProps } from './components/Sidebar'
import { Toolbar, ToolbarProps } from './components/Toolbar'
import { Pager, PagerProps } from './components/Pager'
import { UndoRedo, UndoRedoProps } from './components/UndoRedo'
import { SaveDownloadHelp, SaveDownloadHelpProps } from './components/SaveDownloadHelp'
import { App } from '../model/app'

export class ReactBridge {

    app: App

    constructor(app: App) {
        this.app = app
        app.on('change', () => this.onAppStateChange())
        app.on('change:landmarks', () => this.onLandmarksChange())
        app.on('change:asset', () => this.onAssetChange())

        this.onAppStateChange()
        this.onAssetChange()
        this.onLandmarksChange()
    }

    onAppStateChange() {
        this.renderToolbar()
    }

    onAssetChange() {
        if (!this.app.asset) {
            return
        }
        this.app.asset.on('change:textureOn', () => this.renderToolbar())
        this.renderToolbar()
        this.renderPager()
    }

    onLandmarksChange() {
        if (!this.app.landmarks) {
            return
        }
        this.app.landmarks.landmarks.forEach(lm => {
            lm.on('change', () => this.renderLandmarkTable())
        })
        this.app.landmarks.tracker.on('change', () => {
            this.renderUndoRedo()
            this.renderSaveDownloadHelp()
        })
        this.renderLandmarkTable()
        this.renderUndoRedo()
        this.renderSaveDownloadHelp()
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
            onClickLandmark: (index: number) => {
                if (this.app.landmarks.landmarks[index].isEmpty()) {
                    this.app.landmarks.landmarks[index].setNextAvailable()
                } else {
                    this.app.landmarks.landmarks[index].selectAndDeselectRest()
                }
            }
        }
        const sidebar = Sidebar(props)
        const el = document.getElementById('landmarksPanel')
        ReactDom.render(sidebar, el)
    }

    renderSaveDownloadHelp() {
        if (!this.app.landmarks) {
            return
        }

        // // TODO the saving state will not be reflected in the UI for now.
        // // Ideally, this.app.landmarks.save() should change
        // const props: SaveDownloadHelpProps = {
        //     hasUnsavedChanges: !this.app.landmarks.tracker.isUpToDate,
        //     onSave: () => this.app.landmarks.save(),
        //     onDownload: () => ,
        //     onOpenHelp: () => ,
        // }
        // const saveDownloadHelp = SaveDownloadHelp(props)
        // const el = document.getElementById('landmarksPanel')
        // ReactDom.render(saveDownloadHelp, el)
    }

    renderUndoRedo() {
        if (!this.app.landmarks) {
            return
        }
        const props: UndoRedoProps = {
            canUndo: this.app.landmarks.tracker.canUndo,
            canRedo: this.app.landmarks.tracker.canRedo,
            undo: () => this.app.landmarks.undo(),
            redo: () => this.app.landmarks.redo()
        }
        const undoredo = UndoRedo(props)
        const el = document.getElementById('undoRedo')
        ReactDom.render(undoredo, el)
    }

    renderToolbar() {
        const props: ToolbarProps = {
            isConnectivityOn: this.app.isConnectivityOn,
            isAutosaveOn: this.app.isAutoSaveOn,
            isSnapOn: this.app.isEditingOn,
            isTextureOn: this.app.asset ? this.app.asset.isTextureOn() : false,
            textureToggleEnabled: this.app.meshMode(),
            setAutosave: (on) => this.app.toggleAutoSave(),
            setConnectivity: (on) => this.app.toggleConnectivity(),
            setSnap: (on) => this.app.toggleEditing(),
            setTexture: (on) => this.app.asset ? this.app.asset.textureToggle() : null,
            landmarkSize: this.app.landmarkSize * 100,
            setLandmarkSize: (size) => { this.app.landmarkSize = size / 100 }
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
