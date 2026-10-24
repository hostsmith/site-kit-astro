---
title: Cards
description: Service grids, collection lists and calls to action, in every variant and tone.
sections:
  - id: k0h1
    type: hero
    eyebrow: Section types
    title: Cards
    subtitle: Service grids, collection lists and calls to action, in every variant and tone.
    variant: page
  - id: v1c1
    type: services-grid
    eyebrow: Services grid eyebrow
    title: Services grid, cards, plain
    intro: Items as cards. An item with a link makes its title the link.
    link:
      label: The section's link
      link: /media
    items:
      - title: A card with an icon
        text: The kit's icons and the site's own, from src/icons/.
        icon: square-dot
      - title: A card with a link
        text: Its whole card can be the link's target.
        icon: check
        link: /text
      - title: A card with an image
        text: The image comes first.
        image: /assets/images/placeholder-wide.svg
        imageAlt: Placeholder for a card's photo
    variant: cards
    tone: plain
  - id: v2l2
    type: services-grid
    title: Services grid, list, surface
    items:
      - title: A row with an image
        text: The image beside the text.
        image: /assets/images/placeholder-square.svg
        imageAlt: Placeholder for a row's photo
      - title: A row without one
        text: Just the text.
    variant: list
    tone: surface
  - id: l1c1
    type: collection-list
    title: Collection list, cards
    collection: news
    link:
      label: All news
      link: /news
    variant: cards
  - id: l2l2
    type: collection-list
    title: Collection list, list
    collection: news
    limit: 1
    variant: list
  - id: l3f3
    type: collection-list
    title: Collection list, featured
    collection: news
    variant: featured
  - id: c2b2
    type: cta
    title: Call to action, banner, accent
    text: The default tone.
    button:
      label: Primary button
      link: /contact
    variant: banner
    tone: accent
  - id: c3c3
    type: cta
    title: Call to action, card, dark
    button:
      label: Primary button
      link: /contact
    secondaryButton:
      label: Secondary button
      link: /news
    variant: card
    tone: dark
  - id: c4s4
    type: cta
    title: Call to action, banner, surface
    button:
      label: Primary button
      link: /contact
    variant: banner
    tone: surface
---
