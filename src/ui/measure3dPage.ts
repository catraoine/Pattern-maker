// The recording page for the 3D measuring clips (measure3d.html): the recorder sets each frame through window.__frame.
import { createMeasureScene, shotFor, type Finish, type Lift, type MeasureFrame } from './measure3d';

const q = new URLSearchParams(location.search);
const shot = shotFor(q.get('id') ?? 'waist')!;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const w = Number(q.get('w') ?? 720);
const h = Number(q.get('h') ?? 1280);
canvas.style.width = `${w}px`;
canvas.style.height = `${h}px`;
const pose = q.get('pose');
const limbs = pose ? await (await fetch(`/measure-limbs/limbs-${pose}.json`)).json() : undefined;
const scene = createMeasureScene(canvas, shot, (q.get('look') ?? 'none') as Lift, q.get('limbs') !== '0', (q.get('finish') ?? 'satin') as Finish, limbs);
const win = window as unknown as { __frame: (f: MeasureFrame) => void; __cm: number; __ready: boolean };
win.__frame = (f) => scene.render(f, w, h);
win.__cm = scene.total;
win.__ready = true;
