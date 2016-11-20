import * as _ from 'underscore'
import * as Backbone from 'backbone'
import * as $ from 'jquery'

import download from '../lib/download'
import TemplatePanel from './templates'

// click logic for landmarks
//     handleClick: function (event) {
//         if (this._clickedTimeout === null) {
//             this._clickedTimeout = setTimeout(() => {
//                 this._clickedTimeout = null
//                 this.select(event)
//             }, 200)
//         } else {
//             clearTimeout(this._clickedTimeout)
//             this._clickedTimeout = null
//             this.selectGroup(event)
//         }
//     },

//     select: function (event) {
//         if (event.shiftKey) {
//             this.selectAll(event)
//         } else if (this.model.isSelected()) {
//             this.model.deselect()
//         } else if (event.ctrlKey || event.metaKey) {
//             if (!this.model.isSelected()) {
//                 this.model.select()
//             }
//         } else if (this.model.isEmpty()) {
//             // user is clicking on an empty landmark - mark it as the next for
//             // insertion
//             this.model.setNextAvailable()
//         } else {
//             this.model.selectAndDeselectRest()
//         }
//     },

//     selectGroup: function () {
//         this.model.group.deselectAll()
//         this.model.group.labels[this.labelIndex].selectAll()
//     },

//     selectAll: function () {
//         this.model.group.selectAll()
//     }
// })

// Multiline for long single groups
// if (this.collection.length === 1) {
//     this.$el.find('.LmGroup-Flex').addClass('MultiLine')
// }


export const ActionsView = Backbone.View.extend({

    el: '#lmActionsPanel',

    initialize: function({app}) {
        _.bindAll(this, 'save', 'help', 'render')
        this.listenTo(this.model.tracker, "change", this.render)
        this.app = app
        this.render()
    },

    events: {
        'click #save': "save",
        'click #help': "help",
        'click #download': "download"
    },

    render: function () {
        this.$el.find('#save')
                .toggleClass('Active', !this.model.tracker.isUpToDate)
    },

    save: function (evt) {
        evt.stopPropagation()
        this.$el.find('#save').addClass('Button--Disabled')
        this.model.save().then(() => {
            this.$el.find('#save').removeClass('Button--Disabled')
        }, () => {
            this.$el.find('#save').removeClass('Button--Disabled')
        })
    },

    help: function (e) {
        e.stopPropagation()  // prevent the event from trigging the help immediately
        this.app.toggleHelpOverlay()
    },

    download: function (evt) {
        evt.stopPropagation()
        if (this.model) {
            this.$el.find('#download').addClass('Button--Disabled')
            const data = JSON.stringify(this.model.toJSON())
            const filename = `${this.app.asset().id}_${this.app.activeTemplate()}.ljson`
            download(data, filename, 'json')
            this.$el.find('#download').removeClass('Button--Disabled')

        }
    }
})

export const UndoRedoView = Backbone.View.extend({

    el: "#undoRedo",

    events: {
        'click .Undo': 'undo',
        'click .Redo': 'redo'
    },

    initialize: function ({app}) {
        this.tracker = this.model.tracker
        this.app = app
        this.listenTo(this.tracker, "change", this.render)
        _.bindAll(this, 'render', 'cleanup', 'undo', 'redo')
        this.render()
    },

    cleanup: function () {
        this.stopListening(this.tracker)
        this.$el.find('.Undo').addClass('Disabled')
        this.$el.find('.Redo').addClass('Disabled')
    },

    render: function () {
        this.$el.find('.Undo').toggleClass('Disabled', !this.tracker.canUndo)
        this.$el.find('.Redo').toggleClass('Disabled', !this.tracker.canRedo)
    },

    undo: function () {
        if (!this.tracker.canUndo) {
            return
        } else {
            this.model.undo()
        }
    },

    redo: function () {
        if (!this.tracker.canRedo) {
            return
        } else {
            this.model.redo()
        }
    }
})

export const LmLoadView = Backbone.View.extend({
    el: '#lmLoadPanel',

    events: {
        'click #loadPrevious': 'loadPrevious'
    },

    initialize: function ({app}) {
        _.bindAll(this, 'render', 'loadPrevious')
        this.app = app
        this.render()
    },

    render: function () {
        const show = this.app.assetSource.hasPredecessor
        this.$el.toggleClass('Hide', !show)
        this.$el.find('button').toggleClass('Button-Danger',
                                            !this.model.isEmpty())
    },

    loadPrevious: function () {
        this.app.reloadLandmarksFromPrevious()
        this.render()
    }
})

export default Backbone.View.extend({

    initialize: function () {
        _.bindAll(this, "landmarksChange")
        this.listenTo(this.model, "change:landmarks", this.landmarksChange)
        this.actionsView = null
        this.lmView = null
        this.undoRedoView = null
        this.templatePanel = new TemplatePanel(this.model)
    },

    landmarksChange: function () {
        console.log('Sidebar - rewiring after landmark change')
        if (this.actionsView) {
            this.actionsView.undelegateEvents()
        }

        if (this.lmLoadView) {
            this.lmLoadView.undelegateEvents()
        }

        if (this.undoRedoView) {
            this.undoRedoView.undelegateEvents()
        }

        const lms = this.model.landmarks

        if (lms === null) {
            return
        }

        this.actionsView = new ActionsView({model: lms, app: this.model})
        this.lmLoadView = new LmLoadView({model: lms, app: this.model})
        this.undoRedoView = new UndoRedoView({model: lms})
        $('#landmarksPanel').html(this.lmView.render().$el)
    }
})
