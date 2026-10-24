---
scope: kit
---

# 8. Brief

Fill in `.hostsmith/brief.md`, which every agent reads before it changes the site's copy. The template's comments say what each heading holds.

- **Business facts:** the name, location, hours and services, from the pages and the settings' facts.
- **Audience** and **Voice:** draft them from the old site's copy: who its pages speak to, how they sound, and the words they use and avoid. Mark the draft as drafted from the old site, and ask the person to confirm or correct it.
- **Do and don't:** what the person tells you, plus what the copy shows, such as an offer every call to action repeats.
- **Contacts:** ask the person. Never guess a name or a channel. Write only names, roles and channels: who sends requests and how, who approves changes, and who the developer is.

When you're done, no placeholder in angle brackets and no guidance comment is left:

```bash
grep -nE '<!--|<[a-z][^>]*>' .hostsmith/brief.md
```

prints nothing. A heading the person can't fill in yet says what's missing, in plain words.
