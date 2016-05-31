import * as _ from 'underscore'
import * as Backbone from 'backbone'
import { App } from '../model/app'
import * as Asset from '../model/asset'

export class LandmarkSizeSlider extends Backbone.View<App> {

    constructor(model: App) {
        super({
            model,
            el: '#lmSizeSlider' ,
            events: {
                input: "changeLandmarkSize"
            }
        })
        this.listenTo(this.model, "change:landmarkSize", this.render)
        // set the size immediately.
        this.render()
    }

    render() {
        this.$el[0].value = this.model.landmarkSize() * 100
        return this
    }

    changeLandmarkSize(event: JQueryInputEventObject) {
        this.model.set(
            "landmarkSize",
            Math.max(Number(event.target.value) / 100, 0.05))
    }

}

export class TextureToggle extends Backbone.View<App> {

    mesh: Asset.Image
    toggle: HTMLInputElement

    constructor(model: App) {
        super({
            model,
            el: '#textureRow',
            events: {
                'click #textureToggle': "textureToggle"
            }
        })

        this.toggle = this.$el.find('#textureToggle')[0] as HTMLInputElement
        this.listenTo(this.model, "newMeshAvailable", this.changeMesh)
        // there could already be an asset we have missed
        if (this.model.asset()) {
            this.changeMesh()
        }
        this.render()
    }

    render() {
        if (this.mesh) {
            this.$el.toggleClass('Toolbar-Row--Disabled',
                !this.mesh.hasTexture())
            this.toggle.checked = this.mesh.isTextureOn()
        } else {
            this.$el.addClass('Toolbar-Row--Disabled')
        }
        return this
    }

    changeMesh = () => {
        if (this.mesh) {
            this.stopListening(this.mesh)
        }
        this.listenTo(this.model.asset(), "all", this.render)
        this.mesh = this.model.asset()
    }

    textureToggle() {
        if (!this.mesh) {
            return
        }
        this.mesh.textureToggle()
    }
}

export class ConnectivityToggle extends Backbone.View<App> {

    toggle: HTMLInputElement

    constructor(model: App) {
        super({
            model,
            el: '#connectivityRow',
            events: {
                'click #connectivityToggle': "toggleConnectivity"
            }
        })
        this.toggle = this.$el.find('#connectivityToggle')[0] as HTMLInputElement
        this.listenTo(this.model, 'change:connectivityOn', this.render)
        this.render()
    }

    render() {
        this.toggle.checked = this.model.isConnectivityOn
        return this
    }

    toggleConnectivity() {
        this.model.toggleConnectivity()
    }
}

export class EditingToggle extends Backbone.View<App> {

    toggle: HTMLInputElement

    constructor(model: App) {
        super({
            model,
            el: '#editingRow',
                events: {
                    'click #editingToggle': "toggleEditing"
                }
        })
        this.toggle = this.$el.find('#editingToggle')[0] as HTMLInputElement
        this.listenTo(this.model, 'change:editingOn', this.render)
        this.render()
    }

    render() {
        this.toggle.checked = this.model.isEditingOn
        return this
    }

    toggleEditing() {
        this.model.toggleEditing()
    }
}

export class AutoSaveToggle extends Backbone.View<App> {

    toggle: HTMLInputElement

    constructor(model: App) {
        super({
            model,
            el: '#autosaveRow',
            events: {
                'click #autosaveToggle': "toggleAutosave"
            }
        })
        this.toggle = this.$el.find('#autosaveToggle')[0] as HTMLInputElement
        this.listenTo(this.model, 'change:autoSaveOn', this.render)
        this.render()
    }

    render() {
        this.toggle.checked = this.model.isAutoSaveOn
        return this
    }

    toggleAutosave() {
        this.model.toggleAutoSave()
    }
}

export default class Toolbar extends Backbone.View<App> {

    lmSizeSlider: LandmarkSizeSlider
    connectivityToggle: ConnectivityToggle
    editingToggle: EditingToggle
    textureToggle: TextureToggle
    autosaveToggle: AutoSaveToggle

    constructor(model: App) {
        super({
            model: model,
            el: '#toolbar'
        })
        this.lmSizeSlider = new LandmarkSizeSlider(this.model)
        this.connectivityToggle = new ConnectivityToggle(this.model)
        this.editingToggle = new EditingToggle(this.model)
        if (this.model.meshMode()) {
            this.textureToggle = new TextureToggle(this.model)
        } else {
            // in image mode, we shouldn't even have these controls.
            this.$el.find('#textureRow').css("display", "none")
        }
        this.autosaveToggle = new AutoSaveToggle(this.model)
    }
}
