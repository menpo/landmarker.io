import * as React from 'react'

const defaultClassName = 'ModalWindow'

function modalClassName(modifiers: string[]): string {
    let className = defaultClassName + ` ${defaultClassName}--Open`
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
    close: () => void
    modifiers: string[]
    closable: boolean
    title?: string
}

export function Modal(props: ModalProps) {
    return (
        <div className={modalClassName(props.modifiers)}>
            { props.closable ? <div className={`${defaultClassName}__Close`} onClick={() => props.close()}>&times;</div> : null }
            { props.title ? <div className={`${defaultClassName}__Title`}>{props.title}</div> : null }
            {React.Children.map(props.children, modifyChild)}
        </div>
    )
}
