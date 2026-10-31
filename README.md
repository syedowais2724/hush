# Hush

Private, on-device dictation for Windows.

Hold a key, speak, release — the words land at your cursor. No account, no cloud, no audio leaving the machine.

## Two engines

| Engine | Source | Size | Notes |
| --- | --- | --- | --- |
| **Whisper base.en** | OpenAI Whisper, via [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | 59.7 MB | Default. Most accurate. English-only, CPU, ~2s for a sentence |
| **Whistle** | [Cactus Compute](https://github.com/cactus-compute/needle) | 16.9 MB | Instant, low power, 7 languages (EN/DE/FR/ES/IT/NL/PL) |

Whisper is MIT-licensed. Whistle is Apache-2.0. Both models run locally; there is no API call and no upload.

## Download

Builds are attached to the [latest release](https://github.com/syedowais2724/hush/releases/latest):

- `Hush-0.1.0-portable.exe` — no install, runs from anywhere, fully offline (both models bundled)
- `Hush-Setup-0.1.0.exe` — normal Windows installer
- `Hush-0.1.0-lite.exe` — smaller shareable build. Includes Whistle; Whisper downloads once from Settings → Downloads, or automatically on the first accurate dictation

The executables are unsigned, so Windows SmartScreen may show **Unknown publisher**. Choose **More info → Run anyway**.

## Build from source

```sh
git clone https://github.com/syedowais2724/hush.git
cd hush
npm install
npm run dev
```

## First run

1. Hold **Right Ctrl** anywhere.
2. Speak naturally.
3. Release. The transcript is pasted at the cursor.

If the microphone is blocked, open **Windows Settings → Privacy & security → Microphone** and allow desktop apps.

## Tips

- Add names, brands and jargon in **Dictionary**. Whisper uses them as a decoding prompt; Whistle uses them as keyword bias.
- Use **Snippets** for phrases you type often (“my address”, “intro email”).
- Switch engines in **Settings → Recognition engine**.
- Whisper accurate mode is English-only for now. Choosing another language automatically falls back to Whistle.
- The overlay is intentionally a small bottom-center ribbon; it does not take focus from the app you are typing in.

## Development

```sh
npm install
npm run dev        # Vite + Electron
npm run build      # typecheck + renderer build
npm run dist       # full Windows installer + portable
npm run dist:lite  # smaller portable that downloads Whisper on demand
```

The Whisper runtime lives in `tools/whisper/runtime` (whisper-cli.exe, DLLs, and `ggml-base.en-q5_1.bin`). The built app copies that folder to `resources/whisper`. The full builder copies the model; the lite builder filters it out.

Downloaded models are stored in `%APPDATA%\Hush\models\whisper\`. Application state and history live in `%APPDATA%\Hush\hush-state.json`.

## Project layout

- `electron/` — main process, preload, native hotkey/paste (koffi), state store
- `src/` — React renderer (main window + overlay)
- `src/lib/recorder.ts` — microphone capture and Whistle inference
- `electron/main.cjs` — global hotkey, insertion, Whisper process, model downloads
- `tools/whisper/runtime/` — bundled local Whisper runtime + model
- `assets/` — icon, tray icon
