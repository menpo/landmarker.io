import * as _ from 'underscore'
import * as Backbone from 'backbone'
import * as $ from 'jquery'
import { notify } from './notification'
import { Server } from '../backend'
import { App } from '../model/app'
// import ListPicker from './list_picker'

export class TemplatePicker extends Backbone.View<App> {

    constructor(model: App) {
        super({
            model,
            el: '#templatePicker',
            events: {
                'click li': 'select',
                'click .RightSidebar-TemplatePicker-Add': 'add',
                'click input': 'clickInput',
                'keyup input': 'filter'
            }
        })
        _.bindAll(this, 'update', 'render', 'select', 'add', 'reload')
        this.listenTo(this.model, 'change:activeTemplate', this.update)
        this.listenTo(this.model, 'change:templates', this.reload)
    }

    render() {
        const backend = this.model.backend
        const $ul = $('<ul></ul>')
        this.model.templates.forEach((tmpl, index) => {
            $ul.prepend($(`
                <li id="templatePick_${tmpl}"
                    data-template="${tmpl}"
                    data-index="${index}">${tmpl}</li>
            `))
        })

        this.$el.html($ul)
        this.$el.prepend($(`<input type="text" placeholder='Search templates'/>`))

        if (typeof backend.pickTemplate === 'function') {
            this.$el.append(`<div class='RightSidebar-TemplatePicker-Add'></div>`)
        }

        this.update()
        return this
    }

    update() {
        const activeTmpl = this.model.activeTemplate
        if (activeTmpl) {
            this.$el.find('li').removeClass('Active')
            this.$el.find(`#templatePick_${activeTmpl}`)
                    .addClass('Active')
        }
    }

    reload() {
        this.undelegateEvents()
        this.render()
        this.delegateEvents()
    }

    toggle() {
        this.$el.toggleClass('Active')
        this.$el.find('input').focus()
    }

    select(evt) {
        evt.stopPropagation()
        const tmpl = evt.currentTarget.dataset.template
        if (tmpl !== this.model.activeTemplate) {
            this.toggle()
            this.model.autoSaveWrapper(() => {
                this.model.set('activeTemplate', tmpl)
            })
        }
    }

    clickInput(evt) {
        evt.stopPropagation()
    }

    add(evt) {
        evt.stopPropagation()
        if (typeof this.model.backend.pickTemplate === 'function') {
            this.model.backend.pickTemplate((name: string) => {
                this.model._activeTemplate = name
                this.model._initTemplates()
            }, function (err) {
                notify({
                    type: 'error',
                    msg: 'Error picking template ' + err
                })
            }, true)
        }
    }

    filter = _.throttle((evt) => {
        const value = evt.currentTarget.value.toLowerCase()
        if (!value || value === "") {
            this.$el.find('li').fadeIn(200)
        }

        this.model.templates.forEach(function (tmpl) {
            if (tmpl.toLowerCase().indexOf(value) > -1) {
                $(`#templatePick_${tmpl}`).fadeIn(200)
            } else {
                $(`#templatePick_${tmpl}`).fadeOut(200)
            }
        })
    }, 50)
}

export class TemplatePanel extends Backbone.View<App> {

    picker: TemplatePicker

    constructor(model: App) {
        super({
            model,
            el: '#templatePanel',
            events: {
                'click .TemplateName': 'open',
                'click .TemplateDownload': 'download'
            }
        })
        _.bindAll(this, 'update')
        this.picker = new TemplatePicker(this.model)
        this.listenTo(this.model, 'change:activeTemplate', this.update)
    }

    update() {

        if (!this.model) {
            return
        }

        this.undelegateEvents()

        const backend = this.model.backend
        const activeTemplate = this.model.activeTemplate

        const $tn = this.$el.find('.TemplateName')
        this.$el.find('.TemplateDownload').remove()
        $tn.toggleClass('Disabled', this.disabled())
        $tn.text(activeTemplate || '-')

        if (
            typeof backend.downloadTemplate === 'function' &&
            activeTemplate && activeTemplate !== ''
        ) {
            this.$el.append(`<div class='TemplateDownload'><span class="octicon octicon-cloud-download"></span></div>`)
        } else {
            this.$el.find('.TemplateDownload').remove()
        }

        this.delegateEvents()
    }

    disabled() {

        if (!this.model) {
            return true
        }

        const backend = this.model.backend
        const templates = this.model.templates
        return (templates.length <= 1 && backend instanceof Server) &&
               typeof backend.pickTemplate !== 'function'
    }

    open() {
        if (!this.disabled()) {
            this.picker.toggle()
        }
    }

    download(evt) {
        evt.stopPropagation()
        const backend = this.model.backend
        const tmpl = this.model.activeTemplate

        if (typeof backend.downloadTemplate === 'function' && tmpl) {
            backend.downloadTemplate(tmpl)
        }
    }
}

export default TemplatePanel
