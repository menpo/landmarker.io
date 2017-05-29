import * as ReactDom from 'react-dom'
import { Sidebar, SidebarProps } from './components/Sidebar'
import { Toolbar, ToolbarProps } from './components/Toolbar'
import { Pager, PagerProps } from './components/Pager'
import { Help, HelpProps } from './components/Help'
import { UndoRedo, UndoRedoProps } from './components/UndoRedo'
import { SaveDownloadHelp, SaveDownloadHelpProps } from './components/SaveDownloadHelp'
import { ConfirmModal, ConfirmModalProps } from './components/ConfirmModal'
import { PromptModal, PromptModalProps } from './components/PromptModal'
import { IntroModal, IntroModalProps } from './components/IntroModal'
import { ListPickerModal, ListPickerModalProps } from './components/ListPickerModal'
import { App, ModalType, ConfirmModalState, PromptModalState, ListPickerModalState } from '../model/app'

export class ReactBridge {

    app: App

    constructor(app: App) {
        this.app = app
        app.on('change', () => this.onAppStateChange())
        app.on('change:landmarks', () => this.onLandmarksChange())
        app.on('change:asset', () => this.onAssetChange())
        app.on('change:activeModalType', () => this.onActiveModalChange())

        this.onAppStateChange()
        this.onAssetChange()
        this.onLandmarksChange()
        this.onActiveModalChange()
    }

    onAppStateChange() {
        this.renderToolbar()
        this.renderHelp()
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

    onActiveModalChange() {
        switch(this.app.activeModalType) {
            case ModalType.CONFIRM: {
                this.renderConfirmModal()
                break
            }
            case ModalType.PROMPT: {
                this.renderPromptModal()
                break
            }
            case ModalType.INTRO: {
                this.renderIntroModal()
                break
            }
            case ModalType.LIST_PICKER: {
                this.renderListPickerModal()
                break
            }
        }
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
            },
        }
        const sidebar = Sidebar(props)
        const el = document.getElementById('landmarksPanel')
        ReactDom.render(sidebar, el)
    }

    renderSaveDownloadHelp() {
        if (!this.app.landmarks) {
            return
        }

        // TODO the saving state will not be reflected in the UI for now.
        // Ideally, this.app.landmarks.save() should change. Furthermore,
        // The active state needs to be reflected in the css (see old Backbone view for details)
        const props: SaveDownloadHelpProps = {
            hasUnsavedChanges: !this.app.landmarks.tracker.isUpToDate,
            onSave: () => this.app.landmarks.save(),
            onDownload: () => {},
            onOpenHelp: () => this.app.toggleHelpOverlay(),
        }
        const saveDownloadHelp = SaveDownloadHelp(props)
        const el = document.getElementById('lmActionsPanel')
        ReactDom.render(saveDownloadHelp, el)
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
            isTextureOn: this.app.asset ? this.app.asset.isTextureOn : false,
            textureToggleEnabled: this.app.meshMode,
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

    renderHelp() {
        const props: HelpProps = {
            isVisible: this.app.isHelpOverlayOn,
            onClick: () => this.app.toggleHelpOverlay()
        }
        const help = Help(props)
        const el = document.getElementById('helpOverlay')
        console.log("rendering help")
        ReactDom.render(help, el)
    }

    renderConfirmModal() {
        let modalState: ConfirmModalState = <ConfirmModalState>this.app.activeModalState
        let modalProps: ConfirmModalProps = {
            message: modalState.message,
            accept: modalState.accept,
            reject: modalState.reject,
            closable: modalState.closable,
            modifiers: ['Small'],
            close: this.app.closeModal.bind(this.app)
        }
        const confirmModal = ConfirmModal(modalProps)
        const el = document.getElementById('modalsWrapper')
        ReactDom.render(confirmModal, el)
    }

    renderPromptModal() {
        let modalState: PromptModalState = <PromptModalState>this.app.activeModalState
        let modalProps: PromptModalProps = {
            message: modalState.message,
            submit: modalState.submit,
            closable: modalState.closable,
            inputValue: modalState.inputValue,
            setInputValue: this.app.setPromptModalValue.bind(this.app),
            modifiers: ['Small'],
            // TODO: check this!
            close: () => this.app.closeModal(modalState.cancel)
        }
        const promptModal = PromptModal(modalProps)
        const el = document.getElementById('modalsWrapper')
        ReactDom.render(promptModal, el)
    }

    renderIntroModal() {
        let modalProps: IntroModalProps = {
            startServer: this.app.startServer.bind(this.app),
            startDemo: this.app.startDemo.bind(this.app),
            closable: false,
            modifiers: ['Small'],
            close: this.app.closeModal.bind(this.app)
        }
        const introModal = IntroModal(modalProps)
        const el = document.getElementById('modalsWrapper')
        ReactDom.render(introModal, el)
    }

    renderListPickerModal() {
        let modalState: ListPickerModalState = <ListPickerModalState>this.app.activeModalState
        let modalProps: ListPickerModalProps = {
            filteredList: modalState.filteredList,
            submit: modalState.submit,
            useFilter: modalState.useFilter,
            batchSize: modalState.batchSize,
            batchesVisible: modalState.batchesVisible,
            // TODO is this needed?
            searchValue: modalState.searchValue,
            incrementBatchesVisible: this.app.incrementVisibleListPickerBatches.bind(this.app),
            filter: this.app.filterListPicker.bind(this.app),
            closable: modalState.closable,
            modifiers: [],
            close: this.app.closeModal.bind(this.app),
            title: modalState.title
        }
        const listPickerModal = ListPickerModal(modalProps)
        const el = document.getElementById('modalsWrapper')
        ReactDom.render(listPickerModal, el)
    }
}
