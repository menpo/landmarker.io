import * as React from 'react'
import { Modal, ModalProps } from './Modal'

function acceptOrReject(acceptReject: () => void, close: () => void): void {
    acceptReject()
    close()
}

export interface ConfirmModalProps extends ModalProps {
    message: string
    accept: () => void
    reject: () => void
}

export function ConfirmModal(props: ConfirmModalProps) {
    return (
        <Modal close={props.close} modifiers={props.modifiers} closable={props.closable} title={props.title}>
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