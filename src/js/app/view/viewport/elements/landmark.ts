import * as THREE from 'three';
import { Landmark } from '../types'

const LM_SCALE = 0.01;  // the default scale for 1.0
const LM_SPHERE_PARTS = 10;
const LM_SPHERE_SELECTED_COLOR = 0xff75ff;
const LM_SPHERE_UNSELECTED_COLOR = 0xffff00;

// create a single geometry + material that will be shared by all landmarks
const LM_GEOMETRY = new THREE.SphereGeometry(
    LM_SCALE,
    LM_SPHERE_PARTS,
    LM_SPHERE_PARTS
);

const SELECTED_LM_MATERIAL = new THREE.MeshBasicMaterial({color: LM_SPHERE_SELECTED_COLOR})
const UNSELECTED_LM_MATERIAL = new THREE.MeshBasicMaterial({color: LM_SPHERE_UNSELECTED_COLOR})


const lmMaterialForSelected = (selected: boolean) : THREE.Material => 
selected ? SELECTED_LM_MATERIAL : UNSELECTED_LM_MATERIAL

function createSphere(index: number) {
    const landmark = new THREE.Mesh(LM_GEOMETRY, lmMaterialForSelected(false))
    landmark.name = 'Landmark ' + index;
    landmark.userData.index = index;
    return landmark
}

export class LandmarkTHREEView {
    
    onCreate: (symbol: THREE.Object3D) => void
    onDispose: (symbol: THREE.Object3D) => void
    symbol: THREE.Mesh
    index: number
    
    constructor (lm, options) {
        this.onCreate = options.onCreate;
        this.onDispose = options.onDispose;

        // a THREE object that represents this landmark.
        // null if the landmark isEmpty
        this.symbol = null;
        this.index = lm.index

        this.render(lm);
    }

    render = (lm: Landmark) => {
        if (this.symbol) {
            // this landmark already has an allocated representation..
            if (lm.point === null) {
                // but it's been deleted.
                this.dispose();
            } else {
                // the lm may need updating. See what needs to be done
                this.updateSymbol(lm);
            }
        } else {
            // there is no symbol yet
            if (lm.point !== null) {
                // and there should be! Make it and update it
                this.symbol = createSphere(lm.index);
                this.updateSymbol(lm);
                // and add it to the scene
                this.onCreate(this.symbol);
            }
        }
    };

    updateSymbol = (lm: Landmark) => {
        this.symbol.position.copy(lm.point);
        this.symbol.material = lmMaterialForSelected(lm.isSelected);
    };

    dispose = () => {
        if (this.symbol) {
            this.onDispose(this.symbol);
            this.symbol = null;
        }
    }
}
