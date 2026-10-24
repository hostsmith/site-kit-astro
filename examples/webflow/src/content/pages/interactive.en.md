---
title: Interactive
description: Tabs and sliders, which replace Webflow's Tabs and Slider elements.
sections:
  - id: i0h1
    type: hero
    eyebrow: Interactive parts
    title: Tabs and sliders
    subtitle: They replace Webflow's Tabs and Slider, which run on Webflow's script. Without scripts, every panel and every slide still shows.
    variant: page
  - id: a1h1
    type: tabs
    title: Tabs, horizontal
    intro: The arrow keys move between the tabs, and Home and End go to the first and the last.
    items:
      - label: First tab
        title: The first tab's title
        body: The first panel's body, in Markdown.
        link:
          label: The panel's link
          link: /media
      - label: Second tab
        title: The second tab's title
        body: The second panel's body.
        image: /assets/images/placeholder-wide.svg
        imageAlt: Placeholder for the second panel's photo
      - label: Third tab
        body: A panel with a body only.
    variant: horizontal
  - id: a2v2
    type: tabs
    title: Tabs, vertical
    items:
      - label: First tab
        body: The tabs in a column. The up and down arrow keys move between them.
      - label: Second tab
        body: The second panel.
    variant: vertical
  - id: w1f1
    type: slider
    title: Slider, full
    intro: One slide at a time, with previous and next buttons and a status line. It doesn't rotate.
    slides:
      - image: /assets/images/placeholder-wide.svg
        imageAlt: Placeholder for the first slide's photo
        title: The first slide
        body: A slide's body, in Markdown.
        link:
          label: The slide's link
          link: /text
      - image: /assets/images/placeholder-wide.svg
        imageAlt: Placeholder for the second slide's photo
        title: The second slide
      - title: The third slide
        body: A slide without an image.
      - image: /assets/images/placeholder-wide.svg
        imageAlt: Placeholder for the fourth slide's photo
    variant: full
  - id: w2c2
    type: slider
    title: Slider, cards, rotating
    intro: Several slides in a row, rotating every five seconds. It pauses while hovered or focused, stops with its button, and never rotates by itself under reduced motion.
    slides:
      - title: The first card
        body: A card's body.
      - title: The second card
        body: A card's body.
      - title: The third card
        body: A card's body.
      - title: The fourth card
        body: A card's body.
      - title: The fifth card
        body: A card's body.
    autoplay: 5
    variant: cards
---
