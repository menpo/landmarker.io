import * as React from 'react'
import { Modal, ModalProps } from './Modal'

function submit(event: any, submit: (value: string) => void, close: () => void, value: string): void {
    event.preventDefault()
    let v = value
    if (v) {
        v = v.toLowerCase()
    }
    submit(v)
    close()
}

export interface PromptModalProps extends ModalProps {
    message: string
    submit: (value: string) => void
    inputValue: string
    setInputValue: (value?: string) => void
}

export function PromptModal(props: PromptModalProps) {
    return (
        <Modal close={props.close} modifiers={props.modifiers} closable={props.closable} title={props.title}>
            <form className='Prompt' onSubmit={(evt) => submit(evt, props.submit, props.close, props.inputValue)}>
                <p>{props.message}</p>
                <input type='text' onChange={(evt) => props.setInputValue(evt.target.value)}/>
            </form>
        </Modal>
    )
}