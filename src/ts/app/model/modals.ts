import { ConfirmModalProps } from '../view/components/ConfirmModal'
import { PromptModalProps } from '../view/components/PromptModal'

type GenericModalProps = ConfirmModalProps | PromptModalProps

enum ModalType {
    CONFIRM,
    PROMPT
}

interface Modal {
    type: ModalType
    disposeOnClose: boolean
    onClose?: () => void
    props: GenericModalProps
}

interface ModalStore {
    [key: number]: Modal
}

/**
 * Generate a pseudo-random key
 * @return {Number}
 */
function generateModalKey(): number {
    return (new Date()).getTime() + Math.floor(Math.random()) * 1000
}

export class Modals {

    store: ModalStore
    _activeModalKey?: number

    constructor() {
        this.store = {}
        this._activeModalKey = undefined
    }

    _finishOpen(modalKey: number): void {
        if (this._activeModalKey) {
            this.closeModal(this._activeModalKey)
        }
        this._activeModalKey = modalKey
    }

    openConfirmModal(message: string, accept?: () => void, reject?: () => void, closable?: boolean): void {
        let key: number = generateModalKey()
        this.store[key] = {
            type: ModalType.CONFIRM,
            disposeOnClose: true,
            props: {
                message,
                accept,
                reject,
                closable,
                isOpen: true,
                close: () => this.closeModal(key),
                key
            }
        }
        this._finishOpen(key)
    }

    openPromptModal(message: string, submit: (value: any) => void, cancel?: () => void, closable?: boolean): void {
        let key: number = generateModalKey()
        this.store[key] = {
            type: ModalType.PROMPT,
            disposeOnClose: true,
            props: {
                message,
                submit,
                cancel,
                closable,
                isOpen: true,
                close: () => this.closeModal(key),
                key
            }
        }
        this._finishOpen(key)
    }

    closeModal(modalKey: number) {
        let modal: Modal = this.store[modalKey]
        if (modal && modal.props.isOpen) {
            modal.props.isOpen = false
            this._activeModalKey = undefined
            if (modal.onClose) {
                modal.onClose()
            }
            if (modal.disposeOnClose) {
                delete this.store[modalKey]
            }
        }
    }

}