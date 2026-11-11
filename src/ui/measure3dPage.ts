// The recording page for the 3D measuring clips (measure3d.html): the recorder sets each frame through window.__frame.
import '@fontsource/space-grotesk/500.css';
import { createMeasureScene, shotFor, type Finish, type Lift, type MeasureFrame } from './measure3d';

const q = new URLSearchParams(location.search);
const id = q.get('id') ?? 'waist';
const shot = shotFor(id) ?? { path: [] };
const canvas = document.getElementById('c') as HTMLCanvasElement;
const w = Number(q.get('w') ?? 720);
const h = Number(q.get('h') ?? 1280);
canvas.style.width = `${w}px`;
canvas.style.height = `${h}px`;
const pose = q.get('pose');
const wholeName = q.get('whole');
const whole = wholeName ? await (await fetch(`/measure-limbs/body-${wholeName}.json`)).json() : undefined;
const limbs = pose ? await (await fetch(`/measure-limbs/limbs-${pose}.json`)).json() : undefined;
const scene = createMeasureScene(canvas, shot, (q.get('look') ?? 'none') as Lift, q.get('limbs') !== '0', (q.get('finish') ?? 'satin') as Finish, limbs, q.get('tape') === 'dark', q.get('shade') ?? undefined, q.get('face') ? { face: q.get('face')!, ink: q.get('ink') ?? '#2b2418' } : undefined, q.get('shadow') === '1', whole, Number(q.get('tw') ?? 1.6), id);
// The clip's spoken-style directions, written over the foot of the frame (Cat, Nov 11: key directions in text).
const caption = document.createElement('div');
// On a band of the chalk itself, so the words never sit over the dark form; the band stays put, only the words fade.
const band = document.createElement('div');
band.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:${Math.round(h * 0.17)}px;background:linear-gradient(to bottom,rgba(220,213,199,0),#dcd5c7 28%)`;
caption.style.cssText = `position:absolute;left:0;right:0;bottom:${Math.round(h * 0.045)}px;padding:0 ${Math.round(w * 0.08)}px;text-align:center;font:500 ${Math.round(w * 0.047)}px/1.3 'Space Grotesk',sans-serif;color:#2b2418;opacity:0`;
document.body.append(band, caption);
await document.fonts.load(`500 20px 'Space Grotesk'`);
const win = window as unknown as { __frame: (f: MeasureFrame, text?: string, show?: number) => void; __cm: number; __view: unknown; __ready: boolean };
win.__frame = (f, text = '', show = 0) => {
  scene.render(f, w, h);
  caption.textContent = text;
  caption.style.opacity = String(show);
};
win.__cm = scene.total;
win.__view = scene.view;
win.__ready = true;
