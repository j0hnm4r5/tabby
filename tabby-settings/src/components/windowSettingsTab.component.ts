/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { debounce } from 'utils-decorators/dist/esm/debounce/debounce'
import { Component, HostBinding, Inject, NgZone, Optional } from '@angular/core'
import {
    DockingService,
    ConfigService,
    Theme,
    HostAppService,
    Platform,
    isWindowsBuild,
    WIN_BUILD_FLUENT_BG_SUPPORTED,
    BaseComponent,
    Screen,
    PlatformService,
} from 'tabby-core'


/** @hidden */
@Component({
    selector: 'window-settings-tab',
    templateUrl: './windowSettingsTab.component.pug',
})
export class WindowSettingsTabComponent extends BaseComponent {
    screens: Screen[]
    Platform = Platform
    isFluentVibrancySupported = false

    @HostBinding('class.content-box') true

    constructor (
        public config: ConfigService,
        public hostApp: HostAppService,
        public platform: PlatformService,
        public zone: NgZone,
        @Inject(Theme) public themes: Theme[],
        @Optional() public docking?: DockingService,
    ) {
        super()

        this.themes = config.enabledServices(this.themes)

        const dockingService = docking
        if (dockingService) {
            this.subscribeUntilDestroyed(dockingService.screensChanged$, () => {
                this.zone.run(() => this.screens = dockingService.getScreens())
            })
            this.screens = dockingService.getScreens()
        }

        this.isFluentVibrancySupported = isWindowsBuild(WIN_BUILD_FLUENT_BG_SUPPORTED)
    }

    get dockFillLabel (): string {
        const dock = this.config.store.appearance.dock
        return dock === 'top' || dock === 'bottom' ? 'Height' : 'Width'
    }

    get dockFillDescription (): string {
        const dock = this.config.store.appearance.dock
        return dock === 'top' || dock === 'bottom' ? 'Percentage of screen height' : 'Percentage of screen width'
    }

    get dockSpaceLabel (): string {
        const dock = this.config.store.appearance.dock
        return dock === 'top' || dock === 'bottom' ? 'Width' : 'Height'
    }

    get dockSpaceDescription (): string {
        const dock = this.config.store.appearance.dock
        return dock === 'top' || dock === 'bottom' ? 'Percentage of screen width' : 'Percentage of screen height'
    }

    @debounce(500)
    saveConfiguration (requireRestart?: boolean) {
        this.config.save()
        if (requireRestart) {
            this.config.requestRestart()
        }
    }
}
