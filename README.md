# Organizrr

Organizrr is a local-first, open-source file labeling and PDF splitting/merging tool built to support back office workflows in the financial advisory sector.

Runs fully in the browser (no backend, no file uploads), and can be installed as a PWA. Built with React, Go, and WASM.

---

## 🧱 Tech Stack

| Layer       | Tech                                                                   |
| ----------- | ---------------------------------------------------------------------- |
| Frontend    | React, Vite, Mantine                                                   |
| PWA         | Vite PWA Plugin                                                        |
| PDF Engine  | Go (compiled to WASM) using [pdfcpu](https://github.com/pdfcpu/pdfcpu) |
| WASM Loader | Native via `wasm_exec.js`                                              |
| Build       | Multi-stage Dockerfile for production deployment                       |

---

## 🚀 Getting Started

### 1. Clone the Repo

```bash
git clone https://github.com/InnoPeak-GmbH/organizrr.git
cd organizrr
```

### 2. Install JS Dependencies

```bash
pnpm install
# or
npm install
```

### 3. Compile Go to WASM

Make sure you have Go installed (>= 1.21):

```bash
GOOS="js" GOARCH="wasm" go build -o ./src/main.wasm ./go
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" ./src
```

> This will output the `main.wasm` binary and include the Go JS runtime shim (`wasm_exec.js`) in your `src` folder.

### 4. Start Dev Server

```bash
npm run dev
```

App will be served at `http://localhost:5173`.

---

## 📦 Production Build

```bash
npm run build
```

Static assets will be built to `dist/`.

---

## 🐳 Docker Build (Multi-Stage)

This project includes a multi-stage `Dockerfile`:

1. Builds the Go WASM binary and copies `wasm_exec.js`
2. Installs Node deps and builds the frontend
3. Serves it using `vercel/serve`

```bash
docker build -t organizrr .
docker run -p 3000:3000 organizrr
```

App will be served at `http://localhost:3000`.

---

## 💡 Project Goals

Organizrr is not a commercial product. We built it to improve the efficiency of internal teams who:

- Receive a large number of files from customers
- Regularly split, merge, and label PDFs
- Need to work **without uploading sensitive data to the cloud**

Organizrr runs entirely in-browser and respects privacy by design. It’s open-source and built to be forked, modified, and branded.

---

## 🛠 Customize It

- Want to change file label presets? Edit them in the `src/utils.tsx` file.
- Want to theme or rebrand? The Mantine-based UI is fully customizable.
- Need different PDF logic? Extend the Go WASM module.

---

## 📜 License

MIT License.

---

## 📎 Links

- 🔗 Live: [organizrr.innopeak.ch](https://organizrr.innopeak.ch)
- 💻 Code: [github.com/InnoPeak-GmbH/organizrr](https://github.com/InnoPeak-GmbH/organizrr)
