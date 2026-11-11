// The recording page for the 3D measuring clips (measure3d.html): the recorder sets each frame through window.__frame.
import { createMeasureScene, shotFor, type Lift, type MeasureFrame } from './measure3d';

const q = new URLSearchParams(location.search);
const shot = shotFor(q.get('id') ?? 'waist')!;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const w = Number(q.get('w') ?? 720);
const h = Number(q.get('h') ?? 1280);
canvas.style.width = `${w}px`;
canvas.style.height = `${h}px`;
const scene = createMeasureScene(canvas, shot, (q.get('look') ?? 'none') as Lift, q.get('limbs') !== '0');
(window as unknown as { __frame: (f: MeasureFrame) => void; __cm: number }).__frame = (f) => scene.render(f, w, h);
(window as unknown as { __cm: number }).__cm = scene.total;
(window as unknown as { __ready: boolean }).__ready = true;
