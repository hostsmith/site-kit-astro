---
title: Embeds
description: A map, videos and other content in frames that load only when the visitor asks.
sections:
  - id: j0h1
    type: hero
    eyebrow: Interactive parts
    title: Embeds
    subtitle: They replace Webflow's Map, Embed, Video and YouTube elements. Each one is a placeholder until its button is pressed, so the page sends nothing to the provider before the visitor chooses to.
    variant: page
  - id: j1m1
    type: embed
    title: Embed, map, 4 by 3
    url: https://www.openstreetmap.org/export/embed.html?bbox=-0.1300%2C51.5000%2C-0.1200%2C51.5060&layer=mapnik
    kind: map
    aspect: "4:3"
    caption: A map from OpenStreetMap
  - id: j2v2
    type: embed
    title: Embed, YouTube video, 16 by 9
    url: https://www.youtube.com/watch?v=aqz-KE-bpKQ
    kind: video
    caption: The frame loads from youtube-nocookie.com.
  - id: j3v3
    type: embed
    title: Embed, Vimeo video, 21 by 9
    url: https://vimeo.com/1084537
    kind: video
    aspect: "21:9"
    caption: The frame loads Vimeo's player with dnt=1.
  - id: j4o4
    type: embed
    title: Embed, other content, square
    url: https://example.com/
    kind: other
    aspect: "1:1"
---
