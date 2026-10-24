---
title: The ==webflow== example
description: The site kit's starting point for porting a Webflow design, with every section type and interactive part, unstyled but working.
sections:
  - id: h0m1
    type: hero
    eyebrow: Hero, centered
    title: The ==webflow== example
    subtitle: Every section type, variant and tone of the site kit, and every part that replaces a Webflow element, in a structural theme. A port restyles them.
    cta:
      label: Primary button
      link: /heroes
    secondaryCta:
      label: Secondary button
      link: /interactive
    note: A note under the buttons.
    variant: centered
  - id: r1c2
    type: rich-text
    title: Rich text, narrow
    body: |-
      This example has the same wiring as the kit's `basics` example, and a theme with only the rules each part needs to lay out, work and stay accessible. Its breakpoints are Webflow's: 480, 768 and 992 pixels, and the header shows its nav from 992.

      Each page shows one group of parts. The names on the page say which part you're looking at.
  - id: g1d3
    type: services-grid
    eyebrow: Services grid, cards
    title: The ==groups== of parts
    intro: One page per group. Each card links to its page.
    items:
      - title: Heroes
        text: Every hero variant, the background video included.
        icon: star
        link: /heroes
      - title: Text
        text: Rich text, FAQ, steps, prices, the trust bar and stats.
        icon: file-text
        link: /text
      - title: Media
        text: Galleries with a lightbox, split sections with a video, testimonials and the team.
        icon: square-dot
        link: /media
      - title: Cards
        text: Service grids, collection lists and calls to action.
        icon: check
        link: /cards
      - title: Interactive
        text: Tabs and sliders, the Webflow elements that need a script.
        icon: sparkles
        link: /interactive
      - title: Embeds
        text: A map and videos that load only when the visitor asks.
        icon: map-pin
        link: /interactive/embeds
    variant: cards
    tone: plain
  - id: c1t4
    type: cta
    title: Call to action, banner, ==accent==
    text: The text of the call to action.
    button:
      label: Primary button
      link: /contact
    secondaryButton:
      label: Secondary button
      link: /news
    variant: banner
    tone: accent
---
