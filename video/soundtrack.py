#!/usr/bin/env python3
"""Original tense soundtrack for video/shelters.html, synthesised from scratch (no samples, no
licences). Cues follow the film's story timeline (0-50 s) stretched by the same factor.

Usage: python3 video/soundtrack.py out.wav [stretch]   (stretch defaults to 1.45, as in the page)
"""
import sys
import wave
import numpy as np

SR = 44100
STRETCH = float(sys.argv[2]) if len(sys.argv) > 2 else 1.45
STORY = 50.0
DUR = STORY * STRETCH
N = int(DUR * SR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)


def at(story_s):
    return story_s * STRETCH


def env_curve(points):
    """Piecewise-linear curve over real time from (story time, value) pairs."""
    xs = [at(x) for x, _ in points]
    ys = [y for _, y in points]
    return np.interp(t, xs, ys)


def lowpass(x, cutoff):
    """One-pole low-pass; cutoff may be a constant or a per-sample array."""
    a = np.exp(-2 * np.pi * np.broadcast_to(cutoff, x.shape) / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):  # small loop, fine for ~3 M samples
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def place(buf, start, sound, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N:
        return
    j = min(N, i + len(sound))
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[0, i:j] += sound[: j - i] * gain * l * 1.414
    buf[1, i:j] += sound[: j - i] * gain * r * 1.414


out = np.zeros((2, N))

# --- Intensity: builds through the story, peaks over the empty districts, falls for the end card
intensity = env_curve([(0, 0.25), (4, 0.4), (10, 0.5), (16, 0.65), (24, 0.85), (34, 1.0), (40, 0.8), (44, 0.55), (47, 0.4), (50, 0)])

# --- Drone: D minor, detuned pairs, slow breathing
drone = np.zeros(N)
for f, g in [(36.71, 1.0), (55.0, 0.55), (73.42, 0.4), (110.0, 0.12)]:
    for d in (-0.15, 0.15):
        drone += g * np.sin(2 * np.pi * (f + d) * t + rng.uniform(0, 6))
breath = 0.85 + 0.15 * np.sin(2 * np.pi * t / 7.3)
drone *= breath * (0.35 + 0.65 * intensity)
fade_in = np.clip(t / 2.5, 0, 1)
drone *= fade_in
out += drone * 0.11

# --- Wind: filtered noise whose brightness follows the intensity
noise = rng.standard_normal(N)
wind = lowpass(noise, 180 + 900 * intensity) * (0.4 + 0.6 * intensity) * fade_in
out[0] += wind * 0.22
out[1] += np.roll(wind, 1800) * 0.22

# --- Dissonance over the empty districts: E-flat against the D
diss_env = env_curve([(0, 0), (24, 0), (25.5, 1), (33.5, 1), (35, 0), (50, 0)])
diss = np.zeros(N)
for k in range(1, 7):
    diss += np.sin(2 * np.pi * 77.78 * k * t * (1 + 0.0007 * np.sin(2 * np.pi * 0.3 * t))) / k
diss = lowpass(diss, 900) * diss_env
out += diss * 0.07

# --- Heartbeat pulse from the 1 km reveal to the end of the ranking
def thump(freq=52, length=0.35, decay=14):
    tt = np.arange(int(length * SR)) / SR
    f = freq * (1 + 1.2 * np.exp(-tt * 30))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * decay)

beat = 60 / 64
bt = at(16.6)
while bt < at(43.8):
    lvl = float(np.interp(bt, t, intensity))
    place(out, bt, thump(), 0.9 * lvl)
    place(out, bt + 0.24, thump(46, 0.3, 18), 0.5 * lvl)
    bt += beat

# --- Ticks: one per shelter as it lands (the page drops 46 shelters between story 4.4 and 9.0)
def tick(freq):
    tt = np.arange(int(0.12 * SR)) / SR
    return np.sin(2 * np.pi * freq * tt) * np.exp(-tt * 45)

for i in range(46):
    st = at(4.4 + (i / 46) * 4.6 + 0.3)
    place(out, st, tick(1500 + 300 * (i % 3)), 0.09, pan=-0.6 + 1.2 * i / 45)

# --- Risers before the big turns, booms on them
def riser(length):
    tt = np.arange(int(length * SR)) / SR
    x = lowpass(rng.standard_normal(len(tt)), 200 + 5000 * (tt / length) ** 2)
    return x * (tt / length) ** 2.5

def boom():
    tt = np.arange(int(2.6 * SR)) / SR
    f = 32 + 70 * np.exp(-tt * 9)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 1.6)
    crack = lowpass(rng.standard_normal(len(tt)), 2500) * np.exp(-tt * 22)
    return body + 0.5 * crack

for story, gain in [(0.3, 0.6), (10.6, 0.7), (16.6, 0.85), (20.4, 0.8), (24.5, 0.9), (27.9, 0.75), (31.0, 0.8), (34.6, 0.95)]:
    if story > 2:
        rl = min(1.6 * STRETCH, 2.4)
        place(out, at(story) - rl, riser(rl), 0.22)
    place(out, at(story), boom(), 0.75 * gain)

# --- End card: a single low resolution chord, then silence
end_t = at(44.4)
tt = np.arange(int((DUR - end_t) * SR)) / SR
chord = sum(np.sin(2 * np.pi * f * tt) * g for f, g in [(73.42, 1), (110, 0.6), (146.83, 0.4), (174.61, 0.25)])
chord *= np.minimum(tt / 0.8, 1) * np.exp(-tt * 0.35)
place(out, end_t, chord, 0.12)

# --- Simple room: two feedback delays
for d, g in [(0.113, 0.28), (0.171, 0.22)]:
    k = int(d * SR)
    for ch in range(2):
        y = out[ch].copy()
        for rep in range(1, 5):
            y[k * rep:] += out[ch][: N - k * rep] * (g ** rep)
        out[ch] = y

# Master: fade out at the end, soft clip, normalise to -1 dBFS
fade = np.clip((DUR - t) / 3.0, 0, 1)
out *= fade
out = np.tanh(out * 1.4)
out /= np.max(np.abs(out)) / 0.89

with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((out.T * 32767).astype('<i2').tobytes())
print(f'wrote {sys.argv[1]}: {DUR:.1f} s')
