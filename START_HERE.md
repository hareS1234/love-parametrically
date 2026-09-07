# Start Love, Parametrically offline

Hello! This folder contains a complete offline copy of Love, Parametrically.

The hand model, WebAssembly files, fonts, and paper texture are included. The app only talks to the local server started below.

## Requirements

Install Node.js 24 LTS. No package installation is needed inside this folder.

## macOS and Linux

1. Open Terminal.
2. Change into this unzipped folder.
3. Run `node server.mjs`.
4. Open the printed address: `http://127.0.0.1:4173/`.

## Windows PowerShell

1. Open PowerShell.
2. Change into this unzipped folder with `cd`.
3. Run `node .\server.mjs`.
4. Open the printed address: `http://127.0.0.1:4173/`.

## Notes

- Keep the terminal open while using the app.
- Press Ctrl+C to stop the server.
- The server listens on this computer only.
- The server accepts read-only GET and HEAD requests.

Port 4173 may already be busy. Run `node server.mjs --port 4174` to choose another port. Each port has its own browser storage.

Camera permission is optional. Mouse and keyboard controls cover the complete flow.

Browser storage can be cleared. Export `.bouquet.json`, PNG, or SVG files to keep a copy.
