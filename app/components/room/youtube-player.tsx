import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { IconPlayerPlayFilled } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { PlaybackState } from "@/lib/schemas/room-ws";

// --- IFrame API script loader ------------------------------------------------
//
// `https://www.youtube.com/iframe_api` calls the single global
// `window.onYouTubeIframeAPIReady` once loaded. Module-scoped so the script
// tag is only ever injected once even if this component mounts more than
// once (route remount, HMR, etc); subsequent callers just await the same
// promise / already-resolved `window.YT`.
let iframeApiPromise: Promise<typeof YT> | null = null;

const loadYouTubeIframeApi = (): Promise<typeof YT> => {
  if (typeof window === "undefined") {
    return new Promise(() => {}); // never resolves during SSR — fine, effect-only
  }
  if (window.YT) return Promise.resolve(window.YT);
  if (iframeApiPromise) return iframeApiPromise;

  iframeApiPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
  return iframeApiPromise;
};

// --- Component ----------------------------------------------------------------

export interface YoutubePlayerProps {
  readonly playback: PlaybackState | null;
  /** A song finished naturally — advance the queue AND record play history. */
  readonly onVideoEnded: () => void;
  /**
   * The video failed to load/play (not found, embedding disabled, ...) —
   * advance the queue WITHOUT recording play history: an errored video was
   * never sung.
   */
  readonly onVideoError: () => void;
  readonly className?: string;
  /**
   * "fill" — the container fills its parent box (`h-full w-full`) and lets
   * the YouTube IFrame letterbox the video inside it (black bars against the
   * `bg-black` surface), so the video can be sized by an outer flex/grid box
   * to be as large as possible without overflowing the viewport. Default
   * (false) keeps the intrinsic `aspect-video w-full` box.
   */
  readonly fill?: boolean;
}

export function YoutubePlayer({
  playback,
  onVideoEnded,
  onVideoError,
  className,
  fill = false,
}: YoutubePlayerProps) {
  const { t } = useTranslation("room");
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const loadedVideoIdRef = useRef<string | null>(null);
  const onVideoEndedRef = useRef(onVideoEnded);
  onVideoEndedRef.current = onVideoEnded;
  const onVideoErrorRef = useRef(onVideoError);
  onVideoErrorRef.current = onVideoError;

  const [apiReady, setApiReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Load the IFrame API once, create the player once the container exists.
  useEffect(() => {
    let cancelled = false;
    loadYouTubeIframeApi().then(() => {
      if (cancelled) return;
      setApiReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!apiReady || !containerRef.current || playerRef.current) return;

    playerRef.current = new window.YT!.Player(containerRef.current, {
      playerVars: { autoplay: 0, playsinline: 1 },
      events: {
        onReady: () => setPlayerReady(true),
        onStateChange: (event) => {
          if (event.data === YT.PlayerState.ENDED) {
            onVideoEndedRef.current();
          } else if (event.data === YT.PlayerState.PLAYING) {
            // Playback actually began (autoplay allowed, or the host tapped
            // the blocked-overlay button) — clear any stale blocked flag.
            setAutoplayBlocked(false);
          }
        },
        onError: () => {
          // Every documented code (2 invalid param, 5 HTML5 error, 100 not
          // found, 101/150 embedding disabled) is unplayable from here —
          // tell the host and skip, via the error path so the broken video
          // is NOT written to play history as if it was sung.
          toast.error(t("player.error_skipping"));
          onVideoErrorRef.current();
        },
        onAutoplayBlocked: () => setAutoplayBlocked(true),
      },
    });

    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady]);

  // Sync incoming playback state -> player. The shared playback state (set
  // from the phone controls) drives the player directly — a "playing" status
  // always attempts real playback, no local user-gesture gate. If the
  // browser's autoplay policy blocks it, the `onAutoplayBlocked` event above
  // flips the overlay on and the host taps once; the overlay clears itself
  // on the resulting PLAYING state change.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !playerReady) return;

    const videoId = playback?.currentItem?.videoId ?? null;

    if (videoId !== loadedVideoIdRef.current) {
      if (videoId) {
        if (playback?.status === "playing") {
          player.loadVideoById(videoId);
        } else {
          player.cueVideoById(videoId);
        }
      } else {
        player.stopVideo();
      }
      loadedVideoIdRef.current = videoId;
    } else if (videoId) {
      if (playback?.status === "playing") player.playVideo();
      else if (playback?.status === "paused") player.pauseVideo();
    }

    if (playback) player.setVolume(playback.volume);
  }, [playback, playerReady]);

  const handleStartParty = () => {
    playerRef.current?.playVideo();
    setAutoplayBlocked(false);
  };

  const showBlockedOverlay = playerReady && autoplayBlocked;

  return (
    /* Literal black, not a theme token: this is a video letterbox surface —
       it must stay black around the 16:9 frame in light mode too, matching
       the player chrome YouTube renders. Overlays below share the same
       constraint (scrims over video are always dark). */
    <div
      data-testid="room-player-container"
      className={cn(
        "relative overflow-hidden rounded-lg bg-black",
        fill ? "h-full w-full" : "aspect-video w-full",
        className
      )}
    >
      <div ref={containerRef} className="h-full w-full" />

      {!playerReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <Spinner size="lg" className="text-white" />
        </div>
      )}

      {showBlockedOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <Button
            size="lg"
            data-testid="room-start-party-button"
            onClick={handleStartParty}
          >
            <IconPlayerPlayFilled className="size-5" />
            {t("player.start_party")}
          </Button>
        </div>
      )}
    </div>
  );
}
