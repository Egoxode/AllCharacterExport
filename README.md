# All Character Export

SillyTavern extension. Exports **all** your character cards into one ZIP archive, as PNG or JSON.

Version **1.0.0** ([changelog](CHANGELOG.md))

## AI Disclaimer

This extension was made with an AI assistant. Read the code before you rely on it.

## Install

1. In SillyTavern open **Extensions → Install Extension**.
2. Paste:

```
https://github.com/Egoxode/AllCharacterExport
```

3. Reload the page.

## Usage

1. Open **Extensions** and expand **All Character Export**.
2. Choose the format:
   - **PNG**: the card with its image, the same file SillyTavern keeps in `characters/`.
   - **JSON**: card data only, the same as the JSON option of the character Export button.
3. Click **Export all characters**. Progress is shown below the button; **Cancel** stops the export and nothing is downloaded.
4. The browser downloads `characters_png_YYYY-MM-DD.zip` (or `characters_json_...`).

The chosen format is remembered.

## What is in the archive

- Every character from the character list. Groups and chats are not included.
- An embedded lorebook is part of the card, so it is included automatically.
- Files are named like in SillyTavern: `Alcina_Dimitrescu.png` or `Alcina_Dimitrescu.json`.
- Each card is requested from SillyTavern's own export (`/api/characters/export`), so the files are exactly what the Export button would give you.
- If a card cannot be exported, it is skipped and listed in the message at the end. All other cards are still in the archive.

## Notes

- The archive is built in the browser memory. Hundreds of cards are fine; for many thousands of large PNG cards make sure the browser has enough memory.
- PNG files are stored without recompression (they are already compressed). JSON files are compressed.
- ZIP limits: up to 65 535 files and 4 GB.

## License

MIT. See `LICENSE`.
