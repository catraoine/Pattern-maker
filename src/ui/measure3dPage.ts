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
const wholeName = q.get('whole');
const whole = wholeName ? await (await fetch(`/measure-limbs/body-${wholeName}.json`)).json() : undefined;
const limbs = pose ? await (await fetch(`/measure-limbs/limbs-${pose}.json`)).json() : undefined;
const scene = createMeasureScene(canvas, shot, (q.get('look') ?? 'none') as Lift, q.get('limbs') !== '0', (q.get('finish') ?? 'satin') as Finish, limbs, q.get('tape') === 'dark', q.get('shade') ?? undefined, q.get('face') ? { face: q.get('face')!, ink: q.get('ink') ?? '#2b2418' } : undefined, q.get('shadow') === '1', whole, Number(q.get('tw') ?? 1.6));
const win = window as unknown as { __frame: (f: MeasureFrame) => void; __cm: number; __ready: boolean };
win.__frame = (f) => scene.render(f, w, h);
win.__cm = scene.total;
win.__ready = true;
