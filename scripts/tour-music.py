# The tour's lofi hip hop track (Cat, 2026-10-22): Rhodes-style chords, bass, soft swung boom-bap drums and vinyl
# crackle, all synthesised here, so it's ours to use anywhere. edit-tour.mjs lays scripts/tour-music.m4a under the
# walkthrough and fades it at the video's end. To remake it (needs numpy and scipy):
#   python3 scripts/tour-music.py 150 /tmp/lofi.wav
#   ffmpeg -i /tmp/lofi.wav -af loudnorm=I=-18:TP=-1.5 -c:a aac -b:a 128k scripts/tour-music.m4a
import sys, numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile
SR = 44100
LENGTH = float(sys.argv[1]) if len(sys.argv) > 1 else 105.0
OUT = sys.argv[2] if len(sys.argv) > 2 else 'lofi.wav'
SEED = int(sys.argv[3]) if len(sys.argv) > 3 else 7
rng = np.random.default_rng(SEED)
BPM = 80
BEAT = 60 / BPM
BAR = 4 * BEAT
N = int(SR * (LENGTH + 3))
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x)
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def add(bus, t, sig, g=1.0):
    i = int(t * SR)
    if i >= len(bus): return
    n = min(len(sig), len(bus) - i); bus[i:i + n] += g * sig[:n]
def swing(eighth):  # swung eighth-note position, in beats
    return eighth // 2 + (0.62 if eighth % 2 else 0)

keys = np.zeros(N); bass = np.zeros(N); drums = np.zeros(N)

def rhodes(m, dur, vel):
    n = int(SR * (dur + 1.2)); t = np.arange(n) / SR; f = mtof(m) * (1 + rng.normal(0, 0.0015))
    wob = 0.0025 * np.sin(2 * np.pi * 0.35 * t)  # tape wow
    ph = 2 * np.pi * f * (t + np.cumsum(wob) / SR)
    tone = np.sin(ph + 0.9 * np.exp(-t * 7) * np.sin(ph * 1)) + 0.18 * np.sin(2 * ph) + 0.06 * np.exp(-t * 18) * np.sin(7.1 * ph)
    env = (1 - np.exp(-t / 0.004)) * (0.55 * np.exp(-t / 0.35) + 0.45 * np.exp(-t / 2.4))
    env *= np.clip((dur + 0.25 - t) / 0.25, 0, 1)  # release
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.3 * t)
    return vel * tone * env * trem

# Fmaj9 - Em9 - Dm9 - Cmaj9, with the top voice moving a little
CHORDS = [(41, [57, 60, 64, 67]), (40, [55, 59, 62, 66]), (38, [53, 57, 60, 64]), (36, [52, 55, 59, 62])]
CHORDS_B = [(41, [57, 60, 64, 69]), (40, [55, 59, 62, 67]), (38, [53, 57, 60, 65]), (43, [53, 57, 59, 64])]
bars = int(LENGTH / BAR) + 1
for b in range(bars):
    t0 = b * BAR
    root, notes = (CHORDS if (b // 4) % 2 == 0 else CHORDS_B)[b % 4]
    # main hit, a little strummed, and a softer push on the and of 3
    for k, m in enumerate(notes):
        add(keys, t0 + k * 0.012 + rng.normal(0, 0.004), rhodes(m, BEAT * 2.3, 0.22 * rng.uniform(0.85, 1)))
    for k, m in enumerate(notes[1:]):
        add(keys, t0 + swing(5) * BEAT + k * 0.01, rhodes(m, BEAT * 1.1, 0.12 * rng.uniform(0.8, 1)))
    # bass: root on 1, root again on the and of 2, a fifth/approach on 4
    for pos, m, d in [(0, root, 1.4), (swing(3), root, 0.6), (3, root + 7 if b % 2 else root + 12, 0.8)]:
        n = int(SR * (d * BEAT + 0.2)); t = np.arange(n) / SR; f = mtof(m)
        s = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * (1 - np.exp(-t / 0.006)) * np.exp(-t / 0.9) * np.clip((d * BEAT + 0.1 - t) / 0.1, 0, 1)
        add(bass, t0 + pos * BEAT, s, 0.42)

def kick(v):
    n = int(SR * 0.45); t = np.arange(n) / SR
    f = 48 + 70 * np.exp(-t / 0.03); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    return v * np.tanh(1.6 * s)
def snare(v):
    n = int(SR * 0.35); t = np.arange(n) / SR
    nz = bp(rng.normal(0, 1, n), 900, 5000) * np.exp(-t / 0.09)
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05)
    return v * (0.55 * nz + 0.5 * tone)
def hat(v, open_=False):
    n = int(SR * (0.25 if open_ else 0.06)); t = np.arange(n) / SR
    return v * hp(rng.normal(0, 1, n), 7000) * np.exp(-t / (0.07 if open_ else 0.018))

drum_from, drum_to = 2, bars - 2  # chords alone for two bars at each end
for b in range(drum_from, drum_to):
    t0 = b * BAR
    fill = b % 8 == 7
    for e in ([0, 5] + ([7] if b % 2 else [])):
        add(drums, t0 + swing(e) * BEAT + rng.normal(0, 0.004), kick(0.9 if e == 0 else 0.65))
    for e in [2, 6]:
        add(drums, t0 + swing(e) * BEAT + 0.012 + rng.normal(0, 0.005), snare(0.55))
    if fill: add(drums, t0 + swing(7) * BEAT, snare(0.22))
    for e in range(8):
        add(drums, t0 + swing(e) * BEAT + rng.normal(0, 0.006), hat((0.20 if e % 2 == 0 else 0.12) * rng.uniform(0.7, 1), open_=(e == 7 and b % 4 == 3)))

# a short room on the drums and keys
ir_n = int(SR * 1.2); ir = rng.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / SR / 0.35); ir = lp(ir, 3500); ir /= np.abs(ir).sum() / 6
room = np.convolve(lp(drums * 0.5 + keys, 4000), ir)[:N]
# keys duck a touch under the kick
kick_env = lp(np.abs(drums), 8)
mix = 0.9 * keys * (1 - 0.25 * np.clip(kick_env / (kick_env.max() + 1e-9) * 3, 0, 1)) + bass + 0.8 * drums + 0.12 * room
# vinyl: hiss and sparse crackle
hiss = lp(hp(rng.normal(0, 1, N), 2000), 6000) * 0.006
crack = np.zeros(N); idx = rng.integers(0, N, int(LENGTH * 9)); crack[idx] = rng.normal(0, 0.35, len(idx)); crack = bp(crack, 1500, 7000)
mix = mix + hiss + crack
mix = lp(hp(mix, 35), 5200)  # dusty top end
mix = np.tanh(1.3 * mix) / np.tanh(1.3)
mix = mix[:int(SR * LENGTH)]
fade_in, fade_out = int(SR * 0.8), int(SR * 3.5)
mix[:fade_in] *= np.linspace(0, 1, fade_in); mix[-fade_out:] *= np.linspace(1, 0, fade_out) ** 1.5
mix /= np.abs(mix).max() / 0.89
st = np.stack([mix, np.roll(mix, int(SR * 0.0007))], 1)  # a hair of width
wavfile.write(OUT, SR, (st * 32767).astype(np.int16))
print(OUT, LENGTH)
