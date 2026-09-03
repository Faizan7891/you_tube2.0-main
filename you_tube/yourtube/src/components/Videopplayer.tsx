"use client";

import { useEffect, useRef, useState } from "react";
import axiosInstance from "@/lib/axiosinstance";
import { useUser } from "@/lib/AuthContext";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  Maximize,
  Minimize,
  PictureInPicture,
  PanelsTopLeft,
} from "lucide-react";

interface VideoQuality {
  label: string;
  src: string;
  height?: number;
  width?: number;
}

interface VideoPlayerProps {
  video: {
    _id: string;
    videotitle: string;
    filepath: string;

    qualities?: VideoQuality[];
  };

  

  // 6.4 - Called by the player when the autoplay countdown finishes.
  // The parent component should switch to the next video.
  onNextVideo?: () => void;
}

export default function VideoPlayer({
  video,
  onNextVideo,
}: VideoPlayerProps) {  const { user } = useUser();

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const controlsTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheater, setIsTheater] = useState(false);
const [selectedQuality, setSelectedQuality] =
  useState("Auto");
  // =========================================================
  // 5.6 - AUTO HIDE CONTROLS
  // =========================================================

  const [showControls, setShowControls] = useState(true);

  // =========================================================
  // 5.7 - BUFFERING / LOADING
  // =========================================================

  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferedPercent, setBufferedPercent] = useState(0);

  // =========================================================
  // 6.1 - SUBTITLES / CAPTIONS
  // =========================================================

  const [captionsEnabled, setCaptionsEnabled] = useState(false);

  // =========================================================
  // 6.4 - AUTOPLAY NEXT COUNTDOWN + CANCEL
  // =========================================================

  const [showAutoplayCountdown, setShowAutoplayCountdown] =
    useState(false);
  const [autoplayCountdown, setAutoplayCountdown] = useState(5);

  const autoplayTimerRef = useRef<
    ReturnType<typeof setInterval> | null
  >(null);

  // =========================================================
  // PLAY / PAUSE
  // =========================================================

  const togglePlay = () => {
    const player = videoRef.current;

    if (!player) return;

    if (player.paused) {
      player.play().catch((error) => {
        console.error("Play error:", error);
      });
    } else {
      player.pause();
    }
  };

  // =========================================================
  // TIME UPDATE
  // =========================================================

  const handleTimeUpdate = () => {
    const player = videoRef.current;

    if (!player) return;

    setCurrentTime(player.currentTime);
  };

  // =========================================================
  // 5.4 - WATCH PROGRESS
  // =========================================================

  const getProgressKey = () => {
    return `video-progress-${video._id}`;
  };

  const saveWatchProgress = () => {
    const player = videoRef.current;

    if (!player || !video?._id) return;

    if (player.currentTime > 0) {
      localStorage.setItem(
        getProgressKey(),
        player.currentTime.toString()
      );
    }
  };

  // =========================================================
  // 6.2 - CHANGE VIDEO QUALITY
  // =========================================================

  const changeQuality = async (
    quality: VideoQuality | null
  ) => {
    const player = videoRef.current;

    if (!player) return;

    const currentTime = player.currentTime;
    const wasPlaying = !player.paused;

    const backend =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.BACKEND_URL ||
      "";

    if (!quality) {
      player.src = `${backend}/${video.filepath}`;
      setSelectedQuality("Auto");
    } else {
      player.src = `${backend}/${quality.src}`;
      setSelectedQuality(quality.label);
    }

    player.load();

    player.addEventListener(
      "loadedmetadata",
      () => {
        player.currentTime = Math.min(
          currentTime,
          player.duration || currentTime
        );

        if (wasPlaying) {
          player.play().catch(() => {});
        }
      },
      { once: true }
    );
  };

  const resumeWatchProgress = () => {
    const player = videoRef.current;

    if (!player || !video?._id) return;

    const savedProgress =
      localStorage.getItem(getProgressKey());

    if (!savedProgress) return;

    const savedTime = Number(savedProgress);

    if (
      Number.isFinite(savedTime) &&
      savedTime > 0 &&
      savedTime < player.duration
    ) {
      player.currentTime = savedTime;
      setCurrentTime(savedTime);
    }
  };

  const handleLoadedMetadata = () => {
    const player = videoRef.current;

    if (!player) return;

    setDuration(player.duration);

    resumeWatchProgress();
  };

  // =========================================================
  // 5.7 - BUFFERING PROGRESS
  // =========================================================

  const handleProgress = () => {
    const player = videoRef.current;

    if (!player || !player.duration) return;

    if (player.buffered.length > 0) {
      const bufferedEnd = player.buffered.end(
        player.buffered.length - 1
      );

      const percent = Math.min(
        100,
        (bufferedEnd / player.duration) * 100
      );

      setBufferedPercent(percent);
    }
  };

  // =========================================================
  // SEEK
  // =========================================================

  const handleSeek = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const player = videoRef.current;

    if (!player) return;

    const time = Number(e.target.value);

    player.currentTime = time;
    setCurrentTime(time);
  };

  // =========================================================
  // VOLUME
  // =========================================================

  const handleVolume = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const player = videoRef.current;

    if (!player) return;

    const value = Number(e.target.value);

    player.volume = value;

    setVolume(value);

    if (value === 0) {
      player.muted = true;
      setMuted(true);
    } else {
      player.muted = false;
      setMuted(false);
    }
  };

  const toggleMute = () => {
    const player = videoRef.current;

    if (!player) return;

    player.muted = !player.muted;

    setMuted(player.muted);
  };

  // =========================================================
  // SKIP
  // =========================================================

  const skip = (seconds: number) => {
    const player = videoRef.current;

    if (!player) return;

    player.currentTime = Math.max(
      0,
      Math.min(
        player.duration || 0,
        player.currentTime + seconds
      )
    );

    setCurrentTime(player.currentTime);
  };

  // =========================================================
  // PLAYBACK SPEED
  // =========================================================

  const changePlaybackRate = (rate: number) => {
    const player = videoRef.current;

    if (!player) return;

    player.playbackRate = rate;

    setPlaybackRate(rate);
  };

  // =========================================================
  // FULLSCREEN
  // =========================================================

  const toggleFullscreen = async () => {
    const container = containerRef.current;

    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error(
        "Fullscreen error:",
        error
      );
    }
  };

  // =========================================================
  // THEATER MODE
  // =========================================================

  const toggleTheater = () => {
    setIsTheater((prev) => !prev);
  };

  // =========================================================
  // PICTURE IN PICTURE
  // =========================================================

  const togglePiP = async () => {
    const player = videoRef.current;

    if (!player) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (
        document.pictureInPictureEnabled
      ) {
        await player.requestPictureInPicture();
      }
    } catch (error) {
      console.error(
        "Picture-in-Picture error:",
        error
      );
    }
  };

  // =========================================================
  // 6.1 - TOGGLE SUBTITLES / CAPTIONS
  // =========================================================

  const toggleCaptions = () => {
  const player = videoRef.current;

  if (!player) return;

  const tracks = player.textTracks;

  if (!tracks || tracks.length === 0) {
    console.log("No subtitle tracks found");
    return;
  }

  const track = tracks[0];

  if (track.mode === "showing") {
    track.mode = "hidden";
    setCaptionsEnabled(false);
  } else {
    track.mode = "showing";
    setCaptionsEnabled(true);
  }
};

  // =========================================================
  // 6.4 - AUTOPLAY NEXT COUNTDOWN + CANCEL
  // =========================================================

  const cancelAutoplayCountdown = () => {
    if (autoplayTimerRef.current) {
      clearInterval(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }

    setShowAutoplayCountdown(false);
    setAutoplayCountdown(5);
  };

  const playNextVideo = () => {
    // Prefer the parent's real next-video handler.
    if (onNextVideo) {
      onNextVideo();
      return;
    }

    // Fallback event lets the parent/page handle next-video navigation
    // without requiring a hard-coded route or video-list implementation.
    window.dispatchEvent(
      new CustomEvent("video:autoplay-next", {
        detail: { videoId: video._id },
      })
    );
  };

  const startAutoplayCountdown = () => {
    // Prevent multiple timers if ended fires more than once.
    if (autoplayTimerRef.current) {
      clearInterval(autoplayTimerRef.current);
    }

    setAutoplayCountdown(5);
    setShowAutoplayCountdown(true);

    let remaining = 5;

    autoplayTimerRef.current = setInterval(() => {
      remaining -= 1;
      setAutoplayCountdown(remaining);

      if (remaining <= 0) {
        if (autoplayTimerRef.current) {
          clearInterval(autoplayTimerRef.current);
          autoplayTimerRef.current = null;
        }

        setShowAutoplayCountdown(false);
        playNextVideo();
      }
    }, 1000);
  };

  // =========================================================
  // TIME FORMAT
  // =========================================================

  const formatTime = (time: number) => {
    if (!Number.isFinite(time)) {
      return "0:00";
    }

    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);

    return `${minutes}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // =========================================================
  // 5.6 - AUTO HIDE CONTROLS
  // =========================================================

  const showControlsTemporarily = () => {
    setShowControls(true);

    if (controlsTimeoutRef.current) {
      clearTimeout(
        controlsTimeoutRef.current
      );
    }

    // Keep controls visible when paused
    if (!playing) {
      return;
    }

    controlsTimeoutRef.current =
      setTimeout(() => {
        setShowControls(false);
      }, 3000);
  };

  // =========================================================
// 6.5 - PREVENT MULTIPLE VIDEOS PLAYING SIMULTANEOUSLY
// =========================================================

useEffect(() => {
  const videoElement = videoRef.current;

  if (!videoElement) return;

  const handlePlay = () => {
    const allVideos = document.querySelectorAll("video");

    allVideos.forEach((otherVideo) => {
      if (
        otherVideo !== videoElement &&
        !otherVideo.paused
      ) {
        otherVideo.pause();
      }
    });
  };

  videoElement.addEventListener("play", handlePlay);

  return () => {
    videoElement.removeEventListener("play", handlePlay);
  };
}, []);

  // =========================================================
  // 5.4 - SAVE EVERY 5 SECONDS
  // =========================================================

  useEffect(() => {
    const interval = setInterval(() => {
      saveWatchProgress();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [video?._id]);

  // =========================================================
  // 5.4 - SAVE WHEN LEAVING PAGE
  // =========================================================

  useEffect(() => {
    const handleBeforeUnload = () => {
      saveWatchProgress();
    };

    window.addEventListener(
      "beforeunload",
      handleBeforeUnload
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload
      );
    };
  }, [video?._id]);

  // =========================================================
  // FULLSCREEN STATE
  // =========================================================

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        document.fullscreenElement ===
          containerRef.current
      );
    };

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  // =========================================================
  // VIDEO EVENTS
  // =========================================================

  useEffect(() => {
    const player = videoRef.current;

    if (!player) return;

    const handlePlay = () => {
      setPlaying(true);
      showControlsTemporarily();
    };

    const handlePause = () => {
      setPlaying(false);
      setShowControls(true);

      if (controlsTimeoutRef.current) {
        clearTimeout(
          controlsTimeoutRef.current
        );
      }
    };

    const handleEnded = () => {
      setPlaying(false);
      setShowControls(true);

      if (video?._id) {
        localStorage.removeItem(
          `video-progress-${video._id}`
        );
      }

      // 6.4 - start the 5-second autoplay-next countdown.
      startAutoplayCountdown();
    };

    player.addEventListener(
      "play",
      handlePlay
    );

    player.addEventListener(
      "pause",
      handlePause
    );

    player.addEventListener(
      "ended",
      handleEnded
    );

    return () => {
      player.removeEventListener(
        "play",
        handlePlay
      );

      player.removeEventListener(
        "pause",
        handlePause
      );

      player.removeEventListener(
        "ended",
        handleEnded
      );
    };
  }, [video?._id, onNextVideo]);

  // =========================================================
  // 6.1 - KEYBOARD SHORTCUTS
  // =========================================================

  useEffect(() => {
    const handleKeyDown = (
      e: KeyboardEvent
    ) => {
      const target =
        e.target as HTMLElement;

      // Don't trigger shortcuts while typing
      if (
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA"
      ) {
        return;
      }

      const player = videoRef.current;

      if (!player) return;

      switch (e.key) {
        // SPACE = PLAY / PAUSE
        case " ":
          e.preventDefault();
          togglePlay();
          break;

        // LEFT = BACK 10 / SHIFT = BACK 30
        case "ArrowLeft":
          e.preventDefault();

          skip(
            e.shiftKey ? -30 : -10
          );

          break;

        // RIGHT = FORWARD 10 / SHIFT = FORWARD 30
        case "ArrowRight":
          e.preventDefault();

          skip(
            e.shiftKey ? 30 : 10
          );

          break;

        // UP = VOLUME UP
        case "ArrowUp":
          e.preventDefault();

          player.volume = Math.min(
            1,
            player.volume + 0.1
          );

          setVolume(player.volume);

          if (player.volume > 0) {
            player.muted = false;
            setMuted(false);
          }

          break;

        // DOWN = VOLUME DOWN
        case "ArrowDown":
          e.preventDefault();

          player.volume = Math.max(
            0,
            player.volume - 0.1
          );

          setVolume(player.volume);

          if (player.volume === 0) {
            player.muted = true;
            setMuted(true);
          }

          break;

        // M = MUTE
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;

        // F = FULLSCREEN
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;

        // T = THEATER
        case "t":
        case "T":
          e.preventDefault();
          toggleTheater();
          break;

        // P = PICTURE IN PICTURE
        case "p":
        case "P":
          e.preventDefault();
          togglePiP();
          break;

        // C = CAPTIONS
        case "c":
        case "C":
          e.preventDefault();
          toggleCaptions();
          break;

        // > = SPEED UP
        case ">":
          e.preventDefault();

          changePlaybackRate(
            Math.min(
              2,
              Number(
                (
                  player.playbackRate +
                  0.25
                ).toFixed(2)
              )
            )
          );

          break;

        // < = SPEED DOWN
        case "<":
          e.preventDefault();

          changePlaybackRate(
            Math.max(
              0.5,
              Number(
                (
                  player.playbackRate -
                  0.25
                ).toFixed(2)
              )
            )
          );

          break;

        // N = NEXT VIDEO
        case "n":
        case "N":
          e.preventDefault();
          playNextVideo();
          break;

        default:
          break;
      }

      // Show controls whenever keyboard is used
      setShowControls(true);
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  // =========================================================
  // CONTROL TIMER CLEANUP
  // =========================================================

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(
          controlsTimeoutRef.current
        );
      }

      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
    };
  }, []);

  // Reset the countdown whenever a different video is loaded.
  useEffect(() => {
    cancelAutoplayCountdown();
  }, [video?._id]);

  // =========================================================
  // UI
  // =========================================================

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "";

  return (
    <div
      ref={containerRef}
      onMouseMove={
        showControlsTemporarily
      }
      onMouseEnter={
        showControlsTemporarily
      }
      className={`relative bg-black rounded-lg overflow-hidden group ${
        isTheater
          ? "w-full"
          : "aspect-video"
      } ${
        isFullscreen
          ? "w-screen h-screen rounded-none"
          : ""
      }`}
    >
      {/* =====================================================
          VIDEO
      ===================================================== */}

      <video
  ref={videoRef}
  crossOrigin="anonymous"
        className="w-full h-full object-contain"
        onTimeUpdate={
          handleTimeUpdate
        }
        onLoadedMetadata={
          handleLoadedMetadata
        }
        onClick={togglePlay}
        onWaiting={() =>
          setIsBuffering(true)
        }
        onCanPlay={() =>
          setIsBuffering(false)
        }
        onPlaying={() =>
          setIsBuffering(false)
        }
        onProgress={handleProgress}
        playsInline
      >
        <source
          src={`${backendUrl}/${video?.filepath}`}
          type="video/mp4"
        />

        {/* ===================================================
            6.1 - TEST ENGLISH CAPTIONS

            Backend route:
            /subtitles/test-en.vtt
        =================================================== */}

        <track
  kind="subtitles"
  src="http://localhost:5000/subtitles/test-en.vtt"
  srcLang="en"
  label="English"
/>

        Your browser does not support
        the video tag.
      </video>

      {/* =====================================================
          5.7 - BUFFERING SPINNER
      ===================================================== */}

      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* =====================================================
          6.4 - AUTOPLAY NEXT COUNTDOWN
      ===================================================== */}

      {showAutoplayCountdown && (
        <div className="absolute right-4 bottom-20 z-50 w-72 rounded-lg bg-black/90 p-4 text-white shadow-2xl border border-white/10">
          <div className="text-sm font-semibold">
            Up next
          </div>

          <div className="mt-1 text-sm text-white/80">
            Playing next video in {" "}
            <span className="font-bold text-white">
              {autoplayCountdown}
            </span>{" "}
            seconds
          </div>

          <button
            type="button"
            onClick={cancelAutoplayCountdown}
            className="mt-3 rounded-md border border-white/30 px-3 py-1.5 text-sm font-medium hover:bg-white/10 transition"
          >
            Cancel
          </button>
        </div>
      )}

      {/* =====================================================
          CUSTOM CONTROLS
      ===================================================== */}

      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 transition-opacity duration-300 ${
          showControls
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        }`}
      >
        {/* =================================================
            TIMELINE
        ================================================= */}

        <div className="relative w-full mb-3">
          {/* BUFFERED PROGRESS */}

          <div
            className="absolute top-1/2 left-0 h-1 bg-white/30 rounded-full pointer-events-none"
            style={{
              width: `${bufferedPercent}%`,
              transform:
                "translateY(-50%)",
            }}
          />

          {/* PLAYBACK PROGRESS */}

          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="relative w-full cursor-pointer"
            title="Video progress"
          />
        </div>

        <div className="flex items-center gap-3 text-white">
          {/* BACK 10 */}

          <button
            onClick={() => skip(-10)}
            className="hover:scale-110 transition"
            type="button"
            title="Back 10 seconds"
          >
            <RotateCcw size={22} />
          </button>

          {/* PLAY */}

          <button
            onClick={togglePlay}
            className="hover:scale-110 transition"
            type="button"
            title={
              playing
                ? "Pause"
                : "Play"
            }
          >
            {playing ? (
              <Pause size={22} />
            ) : (
              <Play size={22} />
            )}
          </button>

          {/* FORWARD 10 */}

          <button
            onClick={() => skip(10)}
            className="hover:scale-110 transition"
            type="button"
            title="Forward 10 seconds"
          >
            <RotateCw size={22} />
          </button>

          {/* MUTE */}

          <button
            onClick={toggleMute}
            className="hover:scale-110 transition"
            type="button"
            title={
              muted
                ? "Unmute"
                : "Mute"
            }
          >
            {muted ? (
              <VolumeX size={22} />
            ) : (
              <Volume2 size={22} />
            )}
          </button>

          {/* VOLUME */}

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={
              muted ? 0 : volume
            }
            onChange={handleVolume}
            className="w-24 cursor-pointer"
            title="Volume"
          />

          {/* SPEED */}

          <select
            value={playbackRate}
            onChange={(e) =>
              changePlaybackRate(
                Number(e.target.value)
              )
            }
            className="bg-black/70 text-white border border-white/30 rounded px-2 py-1 text-sm"
            title="Playback speed"
          >
            <option value="0.5">
              0.5x
            </option>

            <option value="1">
              1x
            </option>

            <option value="1.25">
              1.25x
            </option>

            <option value="1.5">
              1.5x
            </option>

            <option value="2">
              2x
            </option>
          </select>

          {/* =================================================
              6.1 - CAPTIONS / CC
          ================================================= */}

          <button
            onClick={toggleCaptions}
            className={`px-2 py-1 rounded font-semibold text-sm transition ${
              captionsEnabled
                ? "bg-white text-black"
                : "bg-transparent text-white hover:bg-white/20"
            }`}
            type="button"
            title={
              captionsEnabled
                ? "Turn captions off"
                : "Turn captions on"
            }
            aria-label={
              captionsEnabled
                ? "Turn captions off"
                : "Turn captions on"
            }
          >
            CC
          </button>

          {/* THEATER */}

          <button
            onClick={toggleTheater}
            className="hover:scale-110 transition"
            type="button"
            title="Theater mode"
          >
            <PanelsTopLeft
              size={22}
            />
          </button>

          {/* PICTURE IN PICTURE */}

          <button
            onClick={togglePiP}
            className="hover:scale-110 transition"
            type="button"
            title="Picture in Picture"
          >
            <PictureInPicture
              size={22}
            />
          </button>

          {video.qualities &&
  video.qualities.length > 0 && (
    <select
      value={selectedQuality}
      onChange={(e) => {
        const value = e.target.value;

        if (value === "Auto") {
          changeQuality(null);
          return;
        }

        const quality =
          video.qualities?.find(
            (item) =>
              item.label === value
          );

        if (quality) {
          changeQuality(quality);
        }
      }}
      className="bg-black/70 text-white border border-white/30 rounded px-2 py-1 text-sm"
      title="Video quality"
    >
      <option value="Auto">
        Auto
      </option>

      {video.qualities.map(
        (quality) => (
          <option
            key={quality.label}
            value={quality.label}
          >
            {quality.label}
          </option>
        )
      )}
    </select>
  )}

          {/* FULLSCREEN */}

          <button
            onClick={toggleFullscreen}
            className="hover:scale-110 transition"
            type="button"
            title={
              isFullscreen
                ? "Exit fullscreen"
                : "Fullscreen"
            }
          >
            {isFullscreen ? (
              <Minimize size={22} />
            ) : (
              <Maximize size={22} />
            )}
          </button>


          {/* TIME */}

          <span className="text-sm ml-2 whitespace-nowrap">
            {formatTime(currentTime)} /{" "}
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}