import * as React from 'react'
import { Modal } from './Modal'

function submit(event: any, value: string | undefined, submit: (value: any) => void, close: () => void): void {
    event.preventDefault()
    let v = value
    if (v) {
        v = v.toLowerCase()
    }
    submit(v)
    close()
}

export interface PromptModalProps {
    message: string
    submit: (value: any) => void
    cancel?: () => void
    closable?: boolean
    // Modal props
    isOpen: boolean
    //dispose: () => void
    close: () => void
    key: number
    //disposeOnClose: boolean
    title?: string
}

interface PromptModalState {
    inputValue?: string
}

export function PromptModal(props: PromptModalProps, state: PromptModalState) {
    return (
        <Modal isOpen={props.isOpen} close={props.close} modifiers={['Small']} key={props.key}
        closable={props.closable === undefined ? true : props.closable} title={props.title}>
            <form className='Prompt' onSubmit={(evt) => submit(evt, state.inputValue, props.submit, props.close)}>
                <p>{props.message}</p>
                <input type='text' value={state.inputValue}/>
            </form>
        </Modal>
    )
}