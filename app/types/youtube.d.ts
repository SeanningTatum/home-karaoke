// Minimal ambient types for the YouTube IFrame Player API — just enough
// surface for `app/components/room/youtube-player.tsx`. Deliberately not
// the full `@types/youtube` package: that package models the entire API
// (playlists, captions, quality levels, ...) and this component only ever
// touches player construction, load/cue/play/pause/volume, and four
// events. Kept local so the shape stays in lockstep with what the
// component actually uses.
//
// Loaded globally via the `https://www.youtube.com/iframe_api` script tag,
// which sets `window.YT` and calls `window.onYouTubeIframeAPIReady()` once
// ready.

declare namespace YT {
  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }

  interface OnStateChangeEvent {
    readonly data: PlayerState;
    readonly target: Player;
  }

  interface OnErrorEvent {
    // 2 = invalid parameter, 5 = HTML5 player error, 100 = video not
    // found/removed, 101/150 = embedding disabled by the uploader.
    readonly data: 2 | 5 | 100 | 101 | 150;
    readonly target: Player;
  }

  interface OnAutoplayBlockedEvent {
    readonly target: Player;
  }

  interface PlayerEvents {
    onReady?: (event: { target: Player }) => void;
    onStateChange?: (event: OnStateChangeEvent) => void;
    onError?: (event: OnErrorEvent) => void;
    // Dispatched by the IFrame API (not in the official TS typings, but a
    // real, documented event) when the browser blocks an autoplay attempt.
    onAutoplayBlocked?: (event: OnAutoplayBlockedEvent) => void;
  }

  interface PlayerVars {
    autoplay?: 0 | 1;
    playsinline?: 0 | 1;
    controls?: 0 | 1;
    rel?: 0 | 1;
    modestbranding?: 0 | 1;
  }

  interface PlayerOptions {
    videoId?: string;
    height?: string | number;
    width?: string | number;
    playerVars?: PlayerVars;
    events?: PlayerEvents;
  }

  class Player {
    constructor(element: HTMLElement | string, options: PlayerOptions);
    loadVideoById(videoId: string): void;
    cueVideoById(videoId: string): void;
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    setVolume(volume: number): void;
    getVolume(): number;
    getPlayerState(): PlayerState;
    // Position getters, used by the TV's progress line / remaining-time
    // readout (feat-014). Both return 0 until the player has loaded metadata,
    // which callers treat as "not known yet" rather than a real value.
    getCurrentTime(): number;
    getDuration(): number;
    destroy(): void;
  }
}

interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
