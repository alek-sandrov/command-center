#!/bin/sh
# Downloads the video's music: "Tensions Run High" by Soundridemusic, free to use with credit
# (credit text: "Music: Tensions Run High by Soundridemusic / Link to Video: https://youtu.be/Ly9H63SLJJo").
# This is the artist's own free-download link from https://soundridemusic.fanlink.tv/tensionsrunhigh
# The MP3 stays out of git: the licence lets us use it in videos, not redistribute it.
set -e
cd "$(dirname "$0")"
curl -fsSL "https://www.dropbox.com/s/2b8u6mtqjmmzfyg/cinematic_tension_soundridemusic.mp3?dl=1" -o tensions-run-high.mp3
echo "saved video/tensions-run-high.mp3"
