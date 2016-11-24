import * as _ from 'underscore'
import * as Backbone from 'backbone'
import { App } from '../model/app'
import * as Asset from '../model/asset'

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
        if (this.model.asset) {
            this.changeMesh()
        }
        this.render()
    }

    render() {
        if (this.mesh) {
            this.$el.toggleClass('Toolbar-Row--Disabled',
                !this.mesh.hasTexture)
            this.toggle.checked = this.mesh.isTextureOn
        } else {
            this.$el.addClass('Toolbar-Row--Disabled')
        }
        return this
    }

    changeMesh = () => {
        if (this.mesh) {
            this.stopListening(this.mesh)
        }
        this.listenTo(this.model.asset, "all", this.render)
        this.mesh = this.model.asset
    }

    textureToggle() {
        if (!this.mesh) {
            return
        }
        this.mesh.textureToggle()
    }
}



export default class Toolbar extends Backbone.View<App> {

    textureToggle: TextureToggle

    constructor(model: App) {
        super({
            model: model,
            el: '#toolbar'
        })
        if (this.model.meshMode()) {
            this.textureToggle = new TextureToggle(this.model)
        } else {
            // in image mode, we shouldn't even have these controls.
            this.$el.find('#textureRow').css("display", "none")
        }
    }
}
