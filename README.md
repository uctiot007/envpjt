# envpjt# envproject

A Node.js REST API backend built with Express.js using MVC architecture, with MongoDB as the database. Includes a VS Code-integrated game promotion system for managing UI-specific collections.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the Server](#running-the-server)
- [Game Promotion System](#game-promotion-system)
- [VS Code Keybinds](#vs-code-keybinds)
- [Contributing](#contributing)

---

## Project Structure

```
envproject/
├── .vscode/
│   └── tasks.json          # VS Code task definitions (promote/demote)
├── configs/                # App and database configuration
├── controllers/            # Route handler logic
├── lib/                    # Reusable helper modules
├── mail-service/           # Email notification setup (Nodemailer)
├── middleware/             # Auth, validation, error handling
├── models/                 # Mongoose schemas and models
├── public/                 # Static assets
├── routes/                 # Express route definitions
├── scripts/
│   ├── promote.js          # Promotes a game to a UI collection
│   └── demote.js           # Removes a game from a UI collection
├── utils/                  # General utility functions
├── .env                    # Environment variables (do NOT commit)
├── .gitignore
├── server.js               # App entry point
└── package.json
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v16+
- [mongosh](https://www.mongodb.com/try/download/shell) installed and in PATH
- MongoDB running locally with the `envproject` database
- VS Code (for the promotion system keybinds)

---

## Installation

```bash
git clone https://github.com/uctiot007/envpjt.git
cd envpjt
npm install
```

---

## Environment Variables

Create a `.env` file in the root with the following keys:

```env
PORT=5000
MONGO_URI=mongodb://teamuser:teampassword123@172.25.7.84:27017/
JWT_SECRET=your_super_secret_key
NODE_ENV=development
STORAGE_SERVER_SECRET=secure_lan_key_123

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Nodemailer
GMAIL=email id
PASS=16 letter code
CLIENT_URL=http://localhost:5173
```

> ⚠️ Never commit `.env` to version control.

---

## Running the Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server runs on the port defined in `.env` (default: `3000`).

---

## Game Promotion System

A `mongosh`-based automation system to promote or demote games between the master `all_games` collection and UI-specific collections (`devs_recommended`, `carousel`).

Games are looked up by their **FitGirl Repack ID** (`fitgirl_id` field in `all_games`). The master `all_games` collection is **never modified** — scripts only read from it.

### Collections

| Collection | Purpose |
|---|---|
| `all_games` | Master database — source of truth, never written to by scripts |
| `devs_recommended` | Games shown in the dev picks UI section |
| `carousel` | Games shown in the homepage carousel |

### How to Use

Trigger via VS Code keybinds (see below) or manually:

```bash
# Promote
mongosh envproject --eval "var fitgirlId='123'; var targetList='carousel';" scripts/promote.js

# Demote
mongosh envproject --eval "var fitgirlId='123'; var targetList='carousel';" scripts/demote.js
```

### Document Requirements

Each document in `all_games` must have a `fitgirl_id` field (stored as a number):

```json
{
  "_id": "ObjectId(...)",
  "fitgirl_id": 123,
  "title": "Game Title",
  ...
}
```

---

## VS Code Keybinds

Add these to your user `keybindings.json` (`Ctrl+Shift+P` → `Preferences: Open Keyboard Shortcuts (JSON)`):

| Keybind | Action |
|---|---|
| `Ctrl+Shift+B` | Promote → pick collection via dropdown |
| `Ctrl+Shift+D` | Demote → pick collection via dropdown |
| `Ctrl+Shift+1` | Promote directly → `devs_recommended` |
| `Ctrl+Shift+2` | Promote directly → `carousel` |
| `Ctrl+Shift+3` | Demote directly from `devs_recommended` |
| `Ctrl+Shift+4` | Demote directly from `carousel` |

```json
[
  {
    "key": "ctrl+shift+b",
    "command": "workbench.action.tasks.runTask",
    "args": "Promote Game to Collection",
    "when": "!inDebugMode"
  },
  {
    "key": "ctrl+shift+d",
    "command": "workbench.action.tasks.runTask",
    "args": "Demote Game from Collection",
    "when": "!inDebugMode"
  },
  {
    "key": "ctrl+shift+1",
    "command": "workbench.action.tasks.runTask",
    "args": "Promote to devs_recommended",
    "when": "!inDebugMode"
  },
  {
    "key": "ctrl+shift+2",
    "command": "workbench.action.tasks.runTask",
    "args": "Promote to carousel",
    "when": "!inDebugMode"
  },
  {
    "key": "ctrl+shift+3",
    "command": "workbench.action.tasks.runTask",
    "args": "Demote from devs_recommended",
    "when": "!inDebugMode"
  },
  {
    "key": "ctrl+shift+4",
    "command": "workbench.action.tasks.runTask",
    "args": "Demote from carousel",
    "when": "!inDebugMode"
  }
]
```

> `keybindings.json` is user-level and is not tracked by Git. Each teammate must add these manually.

---

## Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "describe change"`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request
