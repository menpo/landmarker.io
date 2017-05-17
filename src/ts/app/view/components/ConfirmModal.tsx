import * as React from 'react'
import { Modal } from './Modal'

function acceptOrReject(acceptReject: (() => void) | undefined, close: () => void): void {
    if (acceptReject) {
        acceptReject()
    }
    close()
}

export interface ConfirmModalProps {
    message: string
    accept?: () => void
    reject?: () => void
    closable?: boolean
    // Modal props
    isOpen: boolean
    close: () => void
    key: number
    title?: string
}

export function ConfirmModal(props: ConfirmModalProps) {
    return (
        <Modal isOpen={props.isOpen} close={props.close} modifiers={['Small']} key={props.key}
        closable={props.closable === undefined ? true : props.closable} title={props.title}>
            <div className="ConfirmDialog">
                <p>{props.message}</p>
                <div className="ConfirmActions">
                    <div className="ConfirmAction--Yes" onClick={() => acceptOrReject(props.accept, props.close)}>Yes</div>
                    <div className="ConfirmAction--No" onClick={() => acceptOrReject(props.reject, props.close)}>No</div>
                </div>
            </div>
        </Modal>
    )
}