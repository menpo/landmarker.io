import * as React from 'react'

/**
 * Generate a pseudo-random key
 * @return {Number}
 */
function key() {
    return (new Date()).getTime() + Math.floor(Math.random()) * 1000
}

const defaultClassName = 'ModalWindow'

function modalClassName(modalIsOpen: boolean, modifiers: string[]): string {
    let className = defaultClassName
    if (modalIsOpen) {
        className += ` ${defaultClassName}--Open`
    }
    for (let i = 0; i < modifiers.length; i++) {
        className += ` ${defaultClassName}--` + modifiers[i]
    }
    return className
}

function modifyChild(child: any) {
    const className = `${defaultClassName}__Content ` + child.props.className
    const props = {
        className
    }
    return React.cloneElement(child, props)
}

export interface ModalProps {
    children?: any
    isOpen: boolean
    //dispose: () => void
    close: () => void
    modifiers: string[]
    key: number
    closable: boolean
    //disposeOnClose: boolean
    title?: string
}

export function Modal(props: ModalProps) {
    return (
        props.isOpen ?
        <div className={modalClassName(props.isOpen, props.modifiers)} id={"modalWindow:" + props.key}>
            { props.closable ? <div className={`${defaultClassName}__Close`} onClick={props.close}>&times</div> : null }
            { props.title ? <div className={`${defaultClassName}__Title`}>{props.title}</div> : null }
            {React.Children.map(props.children, modifyChild)}
        </div>
        : <div></div>
    )
}
