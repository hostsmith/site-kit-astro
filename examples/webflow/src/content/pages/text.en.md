---
title: Text
description: Rich text in every variant, the FAQ, steps, prices, the trust bar and stats.
sections:
  - id: x0h1
    type: hero
    eyebrow: Section types
    title: Text
    subtitle: Rich text in every variant, the FAQ, steps, prices, the trust bar and stats.
    variant: page
  - id: t1n1
    type: rich-text
    title: Rich text, narrow
    body: |-
      A reading-width column. Markdown renders with the theme's `sk-prose`: **bold**, *italic*, [a link](/media) and `code`.

      ## A second-level heading

      A paragraph after it, and a list:

      - The first item
      - The second item, with [a link](/cards)

      > A blockquote, as Webflow's Rich Text element shows one.

      ### A third-level heading

      1. An ordered list
      2. Its second item

      | Column | Another column |
      | --- | --- |
      | A table cell | Another cell |
    variant: narrow
  - id: t2w2
    type: rich-text
    title: Rich text, wide
    body: A wider column, for text that reads well across more of the page.
    variant: wide
  - id: t3a3
    type: rich-text
    title: Rich text, title aside
    body: |-
      The title beside the body on wide screens, and above it on narrow ones.

      A second paragraph.
    variant: title-aside
  - id: f1q1
    type: faq
    title: FAQ
    items:
      - question: A question, which opens its answer
        answer: The answer, in Markdown. Native disclosure elements open and close it, with no script.
      - question: Another question
        answer: |-
          An answer with a list:

          - One point
          - Another point
  - id: s1p1
    type: steps
    eyebrow: Steps eyebrow
    title: Steps
    intro: Numbered steps. The theme draws the numbers.
    items:
      - title: The first step
        text: What happens first.
      - title: The second step
        text: What happens next.
      - title: The third step
  - id: p1l1
    type: pricing-list
    title: Pricing list
    items:
      - label: The first price
        price: $10
      - label: The second price
        price: from $20
    note: The note under the prices.
  - id: b1l1
    type: trust-bar
    title: Trust bar, line
    items:
      - text: The first signal
      - text: The second signal
      - text: The third signal
    variant: line
  - id: b2c2
    type: trust-bar
    title: Trust bar, chips
    items:
      - text: The first chip
      - text: The second chip
      - text: The third chip
    variant: chips
  - id: n1p1
    type: stats
    title: Stats, plain
    items:
      - value: "12"
        label: The first figure
      - value: 3.5k
        label: The second figure
      - value: 99%
        label: The third figure
    tone: plain
  - id: n2d2
    type: stats
    title: Stats, ==dark==
    items:
      - value: "4"
        label: The first figure
      - value: "48"
        label: The second figure
    tone: dark
---
