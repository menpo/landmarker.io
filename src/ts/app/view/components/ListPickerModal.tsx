import * as React from 'react'
import { Modal, ModalProps } from './Modal'

function click(index: number, key: string, props: ListPickerModalProps): void {
    if (index === -1) {
        props.incrementBatchesVisible() // load an extra batch
    } else{
        props.close()
        props.submit(parseInt(key))
    }
}

export interface ListPickerModalProps extends ModalProps {
    filteredList: any[][]
    submit: (value: number) => void
    useFilter: boolean
    batchSize: number
    batchesVisible: number
    searchValue: string
    incrementBatchesVisible: () => void
    filter: (value: string) => void
}

export function ListPickerModal(props: ListPickerModalProps) {
    const listPickerElements: any[] = []
    for (let i = 0; i < Math.min(props.batchSize * props.batchesVisible, props.filteredList.length); i++) {
        let [content, key] = props.filteredList[i]
        listPickerElements.push(<li key={i} onClick={() => click(i, key, props)}>{content}</li>)
    }
    return (
        <Modal close={props.close} modifiers={props.modifiers} closable={props.closable} title={props.title}>
            <div className='ListPicker'>
                { props.useFilter ? <input type="text" placeholder='Search' value={props.searchValue} onChange={(evt) => props.filter(evt.target.value)}/> : null }
                <ul>
                    {listPickerElements}
                    { props.filteredList.length > props.batchSize ? <li onClick={() => click(-1, '', props)}>Load more...</li> : null }
                </ul>
            </div>
        </Modal>
    )
}