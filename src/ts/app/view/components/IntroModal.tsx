import * as React from 'react'
import { Modal, ModalProps } from './Modal'

import { version } from '../../../../../package.json'

export interface IntroModalProps extends ModalProps {
    startServer: () => void
    startDemo: () => void
}

export function IntroModal(props: IntroModalProps) {
    return (
        <Modal close={props.close} modifiers={props.modifiers} closable={props.closable} title={props.title}>
            <div className='Intro'>
                <h1>Landmarker.io</h1>
                <h3><a href="https://github.com/menpo/landmarker.io/releases" title="release notes">v{version}</a></h3>
                <div className='IntroItems'>
                    <div className='IntroItem IntroItem--Server' onClick={props.startServer}>
                        <span className="octicon octicon-globe"></span>
                        <div>Connect to a landmarker server</div>
                    </div>
                    <div className='IntroItem IntroItem--Demo' onClick={props.startDemo}>
                        See a demo
                    </div>
                </div>
                <a href="https://github.com/menpo/landmarker.io" className='IntroFooter'>
                    <span className="octicon octicon-mark-github"></span>&nbsp;
                    More info on Github
                </a>
            </div>
        </Modal>
    )
}