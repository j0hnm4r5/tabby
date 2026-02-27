import { Injectable, NgZone, Inject } from '@angular/core'
import type { Display } from 'electron'
import { ConfigService, DockingService, Screen, PlatformService, BootstrapData, BOOTSTRAP_DATA } from 'tabby-core'
import { ElectronService } from '../services/electron.service'
import { ElectronHostWindow, Bounds } from './hostWindow.service'

@Injectable()
export class ElectronDockingService extends DockingService {
    constructor (
        private electron: ElectronService,
        private config: ConfigService,
        private zone: NgZone,
        private hostWindow: ElectronHostWindow,
        platform: PlatformService,
        @Inject(BOOTSTRAP_DATA) private bootstrapData: BootstrapData,
    ) {
        super()
        this.screensChanged$.subscribe(() => this.repositionWindow())
        platform.displayMetricsChanged$.subscribe(() => this.repositionWindow())

        electron.ipcRenderer.on('host:displays-changed', () => {
            this.zone.run(() => this.screensChanged.next())
        })

        electron.ipcRenderer.on('host:docked-resize', (_event, { fill, space }: { fill: number, space: number }) => {
            this.zone.run(() => {
                this.config.store.appearance.dockFill = fill
                this.config.store.appearance.dockSpace = space
                this.config.save()
            })
        })
    }

    dock (): void {
        const dockSide = this.config.store.appearance.dock

        if (dockSide === 'off' || !this.bootstrapData.isMainWindow) {
            this.electron.ipcRenderer.send('window-set-dock-mode', 'off')
            this.hostWindow.setAlwaysOnTop(false)
            return
        }

        let display = this.electron.screen.getAllDisplays()
            .filter(x => x.id === this.config.store.appearance.dockScreen)[0]
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!display) {
            display = this.getCurrentScreen()
        }

        const newBounds: Bounds = { x: 0, y: 0, width: 0, height: 0 }

        // dockFill = "depth": how far the window extends from its anchored edge,
        //   as a fraction of the screen. Width for left/right/center, height for top/bottom.
        // dockSpace = "span": how much of the parallel edge the window covers,
        //   as a fraction of the screen. Height for left/right/center, width for top/bottom.
        // Both values are updated live by the main process when the user resizes
        // the window edges directly (host:docked-resize IPC).
        const fill = Math.max(0, Math.min(this.config.store.appearance.dockFill, 1))
        const space = Math.max(0, Math.min(this.config.store.appearance.dockSpace, 1))
        const [minWidth, minHeight] = this.hostWindow.getWindow().getMinimumSize()

        const wa = display.workArea
        switch (dockSide) {
            case 'center':
                newBounds.width = Math.max(minWidth, Math.round(fill * wa.width))
                newBounds.height = Math.max(minHeight, Math.round(space * wa.height))
                newBounds.x = wa.x + Math.round((wa.width - newBounds.width) / 2)
                newBounds.y = wa.y + Math.round((wa.height - newBounds.height) / 2)
                break
            case 'left':
                newBounds.width = Math.max(minWidth, Math.round(fill * wa.width))
                newBounds.height = Math.round(wa.height * space)
                newBounds.x = wa.x
                newBounds.y = wa.y + Math.round((wa.height - newBounds.height) / 2)
                break
            case 'right':
                newBounds.width = Math.max(minWidth, Math.round(fill * wa.width))
                newBounds.height = Math.round(wa.height * space)
                newBounds.x = wa.x + wa.width - newBounds.width
                newBounds.y = wa.y + Math.round((wa.height - newBounds.height) / 2)
                break
            case 'top':
                newBounds.width = Math.round(wa.width * space)
                newBounds.height = Math.max(minHeight, Math.round(fill * wa.height))
                newBounds.x = wa.x + Math.round((wa.width - newBounds.width) / 2)
                newBounds.y = wa.y
                break
            case 'bottom':
                newBounds.width = Math.round(wa.width * space)
                newBounds.height = Math.max(minHeight, Math.round(fill * wa.height))
                newBounds.x = wa.x + Math.round((wa.width - newBounds.width) / 2)
                newBounds.y = wa.y + wa.height - newBounds.height
                break
        }

        const alwaysOnTop = this.config.store.appearance.dockAlwaysOnTop

        this.electron.ipcRenderer.send('window-set-dock-mode', dockSide)
        this.hostWindow.setAlwaysOnTop(alwaysOnTop)
        setImmediate(() => {
            this.hostWindow.setBounds(newBounds)
        })
    }

    getScreens (): Screen[] {
        const primaryDisplayID = this.electron.screen.getPrimaryDisplay().id
        return this.electron.screen.getAllDisplays().sort((a, b) =>
            a.bounds.x === b.bounds.x ? a.bounds.y - b.bounds.y : a.bounds.x - b.bounds.x,
        ).map((display, index) => {
            return {
                ...display,
                id: display.id,
                name: display.id === primaryDisplayID ? 'Primary Display' : `Display ${index + 1}`,
            }
        })
    }

    private getCurrentScreen (): Display {
        return this.electron.screen.getDisplayNearestPoint(this.electron.screen.getCursorScreenPoint())
    }

    private repositionWindow () {
        const [x, y] = this.hostWindow.getWindow().getPosition()
        for (const screen of this.electron.screen.getAllDisplays()) {
            const bounds = screen.bounds
            if (x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height) {
                return
            }
        }
        const screen = this.electron.screen.getPrimaryDisplay()
        this.hostWindow.getWindow().setPosition(screen.bounds.x, screen.bounds.y)
    }
}
