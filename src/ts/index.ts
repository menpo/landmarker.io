// include all our style information
require('../scss/main.scss')

// Polyfill promise if it's not globally definted
if (typeof window.Promise !== 'function') {
  require('es6-promise').polyfill()
}

import * as $ from 'jquery'
import * as THREE from 'three'
import * as url from 'url'

import * as utils from './app/lib/utils'
import * as support from './app/lib/support'

import Config from './app/model/config'
import { App, AppOptions } from './app/model/app'
import * as Asset from './app/model/asset'

import { Backend, Server } from './app/backend'

// ReactBridge mirrors Backbone App state to
// our React components trees.
import { ReactBridge } from './app/view/reactbridge'

import { notify } from './app/view/notification'
import Intro from './app/view/intro'
import AssetView from './app/view/asset'
import { URLState } from './app/view/urlstate'
import { BackboneViewport } from './app/view/bbviewport'
import { KeyboardShortcutsHandler } from './app/view/keyboard'


const cfg = Config()

const mixedContentWarning = `
<p>Your are currently trying to connect to a non secured server from a secure (https) connection. This is  <a href='http://www.howtogeek.com/181911/htg-explains-what-exactly-is-a-mixed-content-warning/'>unadvisable</a> and thus we do not allow it.<br><br>
You can visit <a href='http://insecure.landmarker.io${window.location.search}'>insecure.landmarker.io</a> to disable this warning.</p>
`

function resolveBackend(u: url.Url) {
    console.log(
        'Resolving which backend to use for url:', window.location.href, u,
        'and config:', cfg.get())

    // Found a server parameter >> override to traditional mode
    if (u.query.server) {
        const serverUrl = utils.stripTrailingSlash(u.query.server)
        cfg.clear() // Reset all stored data, we use the url
        try {
            const server = new Server(serverUrl)

            if (!server.demoMode) { // Don't persist demo mode
                cfg.set({
                    'BACKEND_TYPE': Server.Type,
                    'BACKEND_SERVER_URL': u.query.server
                }, true)
            } else {
                document.title = document.title + ' - demo mode'
            }

            return resolveMode(server, u)
        } catch (e) {
            if (e.message === 'Mixed Content') {
                Intro.close()
                notify({
                    type: 'error',
                    persist: true,
                    msg: $(mixedContentWarning),
                    actions: [['Restart', utils.restart]]
                })
            } else {
                throw e
            }
            return null
        }
    }

    const backendType = cfg.get('BACKEND_TYPE')

    if (backendType == Server.Type) {
        return _loadServer(u)
    } else {
        return Intro.open()
    }
}

var goToDemo = utils.restart.bind(undefined, 'demo')

function retry(msg: string) {
    notify({
        msg,
        type: 'error',
        persist: true,
        actions: [
          ['Restart', utils.restart],
          ['Go to Demo', goToDemo]
        ]
    })
}

function _loadServer(u: url.Url) {
    const server = new Server(cfg.get('BACKEND_SERVER_URL'))
    u.query.server = cfg.get('BACKEND_SERVER_URL')
    history.replaceState(null, null, url.format(u).replace('?', '#'))
    resolveMode(server, u)
}

function resolveMode (backend: Backend, u: url.Url) {
    backend.fetchMode().then(function (mode) {
        if (mode === 'mesh' || mode === 'image') {
            initLandmarker(backend, mode, u)
        } else {
            retry(`Received invalid mode: ${mode}`)
        }
    }, function (err) {
        console.log(err)
        retry(`Couldn't reach server, are you sure the url was correct`)
    })
}

function initLandmarker(backend: Backend, mode: 'image' | 'mesh', u: url.Url) {

    console.log('Starting landmarker in ' + mode + ' mode')

    // allow CORS loading of textures
    // https://github.com/mrdoob/three.js/issues/687
    THREE.ImageUtils.crossOrigin = ''

    const appInit: AppOptions = { backend, mode }

    if (u.query.hasOwnProperty('t')) {
        appInit._activeTemplate = u.query.t
    }

    if (u.query.hasOwnProperty('c')) {
        appInit._activeCollection = u.query.c
    }

    if (u.query.hasOwnProperty('i')) {
        let idx = u.query.i
        idx = isNaN(idx) ? 0 : Number(idx)
        appInit._assetIndex = idx > 0 ? idx - 1 : 0
    }

    var app = new App(appInit)

    new ReactBridge(app)

    new AssetView({model: app})
    // new ToolbarView(app)

    var bbviewport = new BackboneViewport(document.getElementById('viewportContainer'), app)
    var viewport = bbviewport.viewport

    let prevAsset: Asset.Image = null

    app.on('change:asset', function () {
       console.log('Index: the asset has changed')
        viewport.removeMeshIfPresent()
        if (prevAsset !== null) {
            // clean up previous asset
            console.log('Before dispose: ' + viewport.memoryString())
            prevAsset.dispose()
            console.log('After dispose: ' + viewport.memoryString())
        }
        prevAsset = app.asset
    })

    // update the URL of the page as the state changes
    new URLState(app)

    // ----- KEYBOARD HANDLER ----- //
    $(window).off('keydown')
    const keyboard  = new KeyboardShortcutsHandler(app, viewport)
    keyboard.enable()
}

function handleNewVersion() {

    const $topBar = $('#newVersionPrompt')
    $topBar.text(
        'New version has been downloaded in the background, click to reload.')

    $topBar.click(function () {
        window.location.reload(true)
    })

    $topBar.addClass('Display')
}

document.addEventListener('DOMContentLoaded', function () {

    // Check for new version (vs current appcache retrieved version)
    window.applicationCache.addEventListener('updateready', handleNewVersion)
    if(window.applicationCache.status === window.applicationCache.UPDATEREADY) {
        handleNewVersion()
    }

    // Test for IE
    if (support.ie) {
        // Found IE, do user agent detection for now
        // https://github.com/menpo/landmarker.io/issues/75 for progress
        return notify({
            msg: 'Internet Explorer is not currently supported by landmarker.io, please use Chrome or Firefox',
            persist: true,
            type: 'error'
        })
    }

    // Test for webgl
    if (!support.webgl) {
        return notify({
            msg: $('<p>It seems your browser doesn\'t support WebGL, which is needed by landmarker.io.<br/>Please visit <a href="https://get.webgl.org/">https://get.webgl.org/</a> for more information<p>'),
            persist: true,
            type: 'error'
        })
    }

    cfg.load()
    Intro.init({cfg})
    const u = url.parse(
        utils.stripTrailingSlash(window.location.href.replace('#', '?')), true)

    $(window).on('keydown', function (evt) {
        if (evt.which === 27) {
            Intro.open()
        }
    })

    function canScroll(overflowCSS: string) {
        return overflowCSS === 'scroll' || overflowCSS === 'auto'
    }

    window.document.ontouchmove = function (event) {
        var isTouchMoveAllowed = false
        var p = event.target
        while (p !== null) {
            var style = window.getComputedStyle(p)
            if (style !== null && (canScroll(style.overflow) ||
                                   canScroll(style.overflowX) ||
                                   canScroll(style.overflowY))) {
                isTouchMoveAllowed = true
                break
            }
            p = p.parentNode
        }

        if (!isTouchMoveAllowed) {
            event.preventDefault()
        }

    }

    resolveBackend(u)
})
