import * as React from "react"

const HELP_CONTENTS = [
    ['j', 'go to next asset in collection'],
    ['k', 'go to previous asset in collection'],
    [''],
    ['right click', 'insert next available landmark'],
    ['snap + click', 'move snapped landmark'],
    ['snap + ctrl + move', 'lock snapped landmark'],
    [''],
    ['a', 'select all landmarks'],
    ['g', 'select all landmarks in the active group'],
    ['d', 'delete selected landmarks'],
    ['q / ESC', 'clear current selection'],
    ['z', 'undo last operation'],
    ['y', 'redo last undone operation'],
    ['ctrl + s', 'save current landmarks'],
    ['click outside', 'clear current selection'],
    ['ctrl/cmd + click on landmark', 'select and deselect from current selection'],
    ['click on a landmark', 'select a landmark'],
    ['click + drag on a landmark', 'move landmark points'],
    ['shift + drag not on a landmark', 'draw a box to select multiple landmarks'],
    ['ctrl + shift + drag not on a landmark', 'draw a box to add multiple landmarks to current selection'],
    [''],
    ['l', 'toggle links (landmark connections)'],
    ['t', 'toggle textures (<i>mesh mode only</i>)'],
    ['c', 'change between orthographic and perspective rendering (<i>mesh mode only</i>)'],
    [''],
    ['r', 'reset the camera to default'],
    ['mouse wheel', 'zoom the camera in and out'],
    ['click + drag', 'rotate camera (<i>mesh mode only</i>)'],
    ['right click + drag', 'pan the camera'],
    [''],
    ['?', 'display this help'],
]

const overlayStyle: React.CSSProperties = {
  zIndex: 3,
  background: "rgba(0,0,0,.6)",
  cursor: "pointer",
  pointerEvents: "auto",
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}


const insetStyle: React.CSSProperties = {
  borderCollapse: "collapse",
  background: "white",
  padding: "0",
  maxHeight: "95%",
  maxWidth: "95%",
  overflowY: "scroll",
  display: "block",
}

export interface HelpProps {
    isVisable: boolean
    onClick: () => void
}

export function Help(props: HelpProps) {
    return ( props.isVisable ?
    <div style={overlayStyle} onClick={props.onClick}>
        <table className="HelpContentTable" style={insetStyle}>
            <tbody>
                { HELP_CONTENTS.map(([key, msg], i) => msg !== null ? <tr key={i}><td>{key}</td><td>{msg}</td></tr> : <tr className='title' key={i}><td>{key}</td><td></td></tr> ) }
            </tbody>
        </table>
    </div> : <div></div>
    )
}
