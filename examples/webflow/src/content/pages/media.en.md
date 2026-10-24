---
title: Media
description: Galleries with a lightbox, split sections with a video, testimonials and the team.
sections:
  - id: m0h1
    type: hero
    eyebrow: Section types
    title: Media
    subtitle: Galleries with a lightbox, split sections with a video, testimonials and the team.
    variant: page
  - id: g2g2
    type: gallery
    title: Gallery, grid, with a lightbox
    images:
      - image: /assets/images/placeholder-wide.svg
        alt: Placeholder for the first gallery photo
        caption: The first image's caption
      - image: /assets/images/placeholder-square.svg
        alt: Placeholder for the second gallery photo
        caption: The second image's caption
      - image: /assets/images/placeholder-tall.svg
        alt: Placeholder for the third gallery photo
      - image: /assets/images/placeholder-wide.svg
        alt: Placeholder for the fourth gallery photo
        caption: The fourth image's caption
    lightbox: true
    variant: grid
  - id: g3m3
    type: gallery
    title: Gallery, masonry
    images:
      - image: /assets/images/placeholder-tall.svg
        alt: Placeholder for a tall photo
        caption: Images run down each column
      - image: /assets/images/placeholder-square.svg
        alt: Placeholder for a square photo
      - image: /assets/images/placeholder-wide.svg
        alt: Placeholder for a wide photo
    variant: masonry
  - id: s2l2
    type: split
    eyebrow: Split eyebrow
    title: Split, image left, plain
    body: The image beside the text. The image comes first in reading order, and the variant says which side it shows on.
    image: /assets/images/placeholder-square.svg
    imageAlt: Placeholder for a square photo
    stats:
      - value: "1"
        label: A figure
      - value: "2"
        label: Another figure
    link:
      label: The split's link
      link: /cards
    variant: image-left
    tone: plain
  - id: s3r3
    type: split
    title: Split, image right, surface
    body: The image on the right, on the surface color.
    image: /assets/images/placeholder-square.svg
    imageAlt: Placeholder for a square photo
    variant: image-right
    tone: surface
  - id: s4v4
    type: split
    title: Split, with a ==video==
    body: A muted, looping video in the image's place, with the image as its poster and its alt text as the video's text alternative.
    image: /assets/images/placeholder-video.svg
    imageAlt: Placeholder for a video of gray light moving across a wall
    video: /assets/video/clip.mp4
    videoWebm: /assets/video/clip.webm
    variant: image-left
    tone: plain
  - id: q1g1
    type: testimonials
    title: Testimonials, grid, surface
    items:
      - quote: The first quote, side by side with the second.
        name: A person's name
        role: Their role
        image: /assets/images/placeholder-person.svg
        imageAlt: Placeholder for a portrait
      - quote: The second quote.
        name: Another name
        image: /assets/images/placeholder-person.svg
        imageAlt: Placeholder for another portrait
    variant: grid
    tone: surface
  - id: q2s2
    type: testimonials
    title: Testimonials, single, dark
    items:
      - quote: One quote, shown large.
        name: A person's name
        role: Their role
        image: /assets/images/placeholder-person.svg
        imageAlt: Placeholder for a portrait
    variant: single
    tone: dark
  - id: e1t1
    type: team
    title: Team
    intro: The people, with a photo each.
    items:
      - name: A person's name
        role: Their role
        image: /assets/images/placeholder-person.svg
        imageAlt: Placeholder for a portrait
      - name: Another name
        role: Another role
        image: /assets/images/placeholder-person.svg
        imageAlt: Placeholder for another portrait
      - name: A third name
        image: /assets/images/placeholder-person.svg
        imageAlt: Placeholder for a third portrait
---
