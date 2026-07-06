# Self-host Inter font

The app references `/fonts/Inter-latin.woff2` (a variable woff2). To fetch it
once and commit it to the repo:

```bash
# From the project root
curl -L -o public/fonts/Inter-latin.woff2 \
  "https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip"
# ^ the release is a zip; if you prefer, download manually from
#   https://github.com/rsms/inter/releases and extract
#   "web/Inter var/InterVariable.woff2" → public/fonts/Inter-latin.woff2
```

Then commit:

```bash
git add public/fonts/Inter-latin.woff2
git commit -m "chore(fonts): self-host Inter variable font"
```

If the file is absent, the app falls back to system UI fonts (no broken UI),
so this step is optional but recommended for full design fidelity and to
eliminate all requests to fonts.googleapis.com.
