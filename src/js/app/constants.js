export const TYPE = {
    LOAD_LANDMARKS: "",
    SET_LANDMARK: "",
    SET_NEXT_INSERTION:"",
    SET_SELECTED_LANDMARKS: "",
    AUGMENT_SELECTED_LANDMARKS: "",
    DELETE_LANDMARKS: "",
    CONNECTIVITY_DISPLAY: "",
    TEXTURE_DISPLAY: "",
    SNAP_MODE: "",
    SET_AUTOSAVE: ""
};

// enforce that the strings exactly map to their variable name.
Object.keys(TYPE).map(constant => TYPE[constant] = constant);
