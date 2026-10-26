export interface OverlayToggles {
  cursor: boolean
  highlight: boolean
  typing: boolean
  statusPill: boolean
}

export const DEFAULT_OVERLAY_TOGGLES: OverlayToggles = {
  cursor: true,
  highlight: true,
  typing: true,
  statusPill: true
}

export type OverlaySpeed = 'normal' | 'slow'

export class OverlayController {
  private toggles: OverlayToggles = { ...DEFAULT_OVERLAY_TOGGLES }
  private speed: OverlaySpeed = 'normal'
  private paused = false
  getToggles(): OverlayToggles { return { ...this.toggles } }
  setToggle(key: keyof OverlayToggles, value: boolean): void { this.toggles[key] = value }
  getSpeed(): OverlaySpeed { return this.speed }
  setSpeed(s: OverlaySpeed): void { this.speed = s }
  pause(): void { this.paused = true }
  resume(): void { this.paused = false }
  isPaused(): boolean { return this.paused }
}
