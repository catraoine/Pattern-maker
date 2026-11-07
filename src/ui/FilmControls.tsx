import { useEffect, useState, type RefObject } from 'react';

// The films' own quiet controls, in place of the phone's player (Cat, 2026-11-06: iPhone's big play and skip-ten
// buttons sat over the titles). Tapping the film pauses or plays it; a small play mark and a thin line along the
// bottom show where it is. No sound switch (Cat, 2026-11-07: less clutter; the tap that opens a film lets its sound
// start). Nothing is ever drawn over the picture.

/** Follows the video: playing or not, and how far through it is (0 to 1). */
export function useFilm(video: RefObject<HTMLVideoElement | null>) {
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(0);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const sync = () => {
      setPlaying(!v.paused && !v.ended);
      setDone(v.duration ? v.currentTime / v.duration : 0);
    };
    const events = ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata', 'seeked'];
    events.forEach((e) => v.addEventListener(e, sync));
    sync();
    return () => events.forEach((e) => v.removeEventListener(e, sync));
  }, [video]);
  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused || v.ended) v.play().catch(() => {});
    else v.pause();
  };
  const seek = (fraction: number) => {
    const v = video.current;
    if (v?.duration) v.currentTime = Math.max(0, Math.min(1, fraction)) * v.duration;
  };
  return { playing, done, toggle, seek };
}

type Film = ReturnType<typeof useFilm>;

/** Under the film: a small play or pause mark and a thin line showing how far through it is. */
export function FilmBar({ film }: { film: Film }) {
  return (
    <div className="film-bar">
      <button type="button" className="film-toggle" aria-label={film.playing ? 'Pause' : 'Play'} onClick={film.toggle}>
        <span className={film.playing ? 'film-mark film-pause' : 'film-mark film-play'} aria-hidden="true" />
      </button>
      <div
        className="film-line"
        role="slider"
        tabIndex={0}
        aria-label="How far through the film"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(film.done * 100)}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          film.seek((e.clientX - r.left) / r.width);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') film.seek(film.done + 0.05);
          if (e.key === 'ArrowLeft') film.seek(film.done - 0.05);
        }}
      >
        <span className="film-line-done" style={{ width: `${film.done * 100}%` }} />
      </div>
    </div>
  );
}
