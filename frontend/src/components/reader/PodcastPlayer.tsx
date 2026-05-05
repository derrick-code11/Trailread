import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SPEEDS = [1, 1.25, 1.5] as const;

function formatClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

type Props = {
  src: string;
  durationSeconds?: number | null;
  className?: string;
};

export function PodcastPlayer({ src, durationSeconds, className }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [playbackRate, setPlaybackRate] =
    useState<(typeof SPEEDS)[number]>(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onLoadedMetadata = () =>
      setDuration(audio.duration || durationSeconds || 0);
    const onEnded = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [durationSeconds]);

  const safeDuration = duration > 0 ? duration : durationSeconds ?? 0;

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
  };

  const seekTo = (nextTime: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(
      Math.max(0, nextTime),
      safeDuration || nextTime,
    );
    setCurrentTime(audio.currentTime);
  };

  const updateSpeed = (nextRate: (typeof SPEEDS)[number]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          className="rounded-full px-4"
          onClick={() => void togglePlayback()}
        >
          {isPlaying ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play className="size-4" aria-hidden />
          )}
          {isPlaying ? "Pause" : "Play"}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={() => seekTo(currentTime - 10)}
          aria-label="Rewind 10 seconds"
        >
          <RotateCcw className="size-4" aria-hidden />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={() => seekTo(currentTime + 10)}
          aria-label="Skip forward 10 seconds"
        >
          <RotateCw className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="space-y-2">
        <input
          type="range"
          min={0}
          max={safeDuration || 1}
          step={0.1}
          value={Math.min(currentTime, safeDuration || currentTime)}
          onChange={(event) => seekTo(Number(event.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--color-bg-sunken)]"
          aria-label="Podcast timeline"
        />
        <div className="flex items-center justify-between text-xs font-medium text-[var(--color-text-secondary)]">
          <span>{formatClock(currentTime)}</span>
          <span>{formatClock(safeDuration)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SPEEDS.map((speed) => (
          <Button
            key={speed}
            type="button"
            variant={playbackRate === speed ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => updateSpeed(speed)}
          >
            {speed}x
          </Button>
        ))}
      </div>
    </div>
  );
}
