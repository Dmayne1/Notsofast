#!/bin/bash
# One file per scene with the same settings, joined without re-encoding, then sound added.
set -e
cd /home/claude/notsofast/brand/video
ENC="-c:v libx264 -crf 20 -preset veryfast -pix_fmt yuv420p -r 30"
for d in "$@"; do
  ffmpeg -y -loglevel error -framerate 30 -i d${d}_s1.png -vf "format=yuv420p,loop=-1:1,trim=duration=2.2,fade=t=in:st=0:d=0.25" $ENC tmp_${d}_1.mp4
  ffmpeg -y -loglevel error -framerate 30 -i d${d}_s2.png -f lavfi -i "color=c=0x0b0c0f:s=900x24:r=30" -filter_complex "[0]format=yuv420p,loop=-1:1,trim=duration=6.0[bg];[bg][1]overlay=x='990-900*t/6.0':y=1364:shortest=1,fade=t=in:st=0:d=0.15" -t 6.0 $ENC tmp_${d}_2.mp4
  ffmpeg -y -loglevel error -framerate 30 -i d${d}_s3.png -vf "format=yuv420p,loop=-1:1,trim=duration=2.8,fade=t=in:st=0:d=0.15" $ENC tmp_${d}_3.mp4
  printf "file 'tmp_${d}_1.mp4'\nfile 'tmp_${d}_2.mp4'\nfile 'tmp_${d}_3.mp4'\n" > list_${d}.txt
  ffmpeg -y -loglevel error -f concat -safe 0 -i list_${d}.txt -c copy tmp_${d}_silent.mp4
  ffmpeg -y -loglevel error -i tmp_${d}_silent.mp4 -f lavfi -i "aevalsrc='0.20*sin(2*PI*1100*t)*exp(-45*mod(t-2.2\,1))*between(t\,2.2\,8.15)+0.30*sin(2*PI*196*t)*exp(-5*(t-8.2))*gte(t\,8.2)':s=44100:d=11" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k -shortest tmp_${d}_final.mp4
  mv tmp_${d}_final.mp4 notsofast_no${d}.mp4
  rm -f tmp_${d}_*.mp4 list_${d}.txt
done
