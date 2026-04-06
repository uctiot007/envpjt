# envpjt — Node.js REST API Backend

A modular, production-ready REST API backend built with **Express.js** and **MongoDB (Mongoose)**. The project follows the MVC (Model-View-Controller) pattern and ships with JWT authentication, email notifications, real-time support via Socket.IO, cloud media uploads through Cloudinary, and handy database maintenance scripts.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [API Overview](#api-overview)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- RESTful API with modular routing and controllers
- JWT-based authentication and authorization middleware
- Password hashing with bcryptjs
- Email notifications via Nodemailer
- Real-time events with Socket.IO
- Cloud image/file uploads via Cloudinary
- MongoDB integration with Mongoose ODM
- Database sync, backup, and boot scripts for easy maintenance
- Environment-based configuration with dotenv
- Cookie parsing and CORS support

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ESM modules) |
| Framework | Express.js 4 |
| Database | MongoDB via Mongoose 8 |
| Auth | JSON Web Tokens (jsonwebtoken) + bcryptjs |
| Real-time | Socket.IO 4 |
| Media Storage | Cloudinary 2 |
| Email | Nodemailer 6 |
| Dev tooling | Nodemon |

---

## Project Structure

```
envpjt/
├── configs/          # Database and app-level configuration
├── controllers/      # Business logic — one file per resource
├── lib/              # Reusable internal library modules
├── mail-service/     # Nodemailer setup and email templates
├── middleware/       # Auth checks, error handling, request validation
├── models/           # Mongoose schemas and models
├── public/           # Publicly served static assets
├── routes/           # Express route definitions (maps URLs to controllers)
├── scripts/
│   ├── boot-sync.js  # Runs before dev server starts
│   ├── sync-db.js    # Syncs database state
│   └── backup.js     # Database backup utility
├── utils/            # Shared helper/utility functions
├── .env              # Environment variables (do NOT commit)
├── server.js         # Application entry point
├── package.json
└── package-lock.json
```

---

## Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- A running **MongoDB** instance (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- A **Cloudinary** account (for media uploads)
- An **SMTP** provider or service (for email — Gmail, SendGrid, etc.)

---

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/uctiot007/envpjt.git
   cd envpjt
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory (see [Environment Variables](#environment-variables) below).

---

## Environment Variables

Create a `.env` file at the project root. Below are the variables the app expects:

```env
# Server
PORT=3000

# MongoDB
MONGO_URI=mongodb://localhost:27017/your-database-name

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# Cookie
COOKIE_SECRET=your_cookie_secret

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Mail (Nodemailer)
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=your@email.com
MAIL_PASS=your_email_password
MAIL_FROM=no-reply@yourdomain.com
```

> **Important:** Never commit `.env` to version control. It is already listed in `.gitignore`.

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| Start (production) | `npm start` | Runs `node server.js` |
| Start (development) | `npm run dev` | Runs boot sync then starts server with nodemon |
| Boot sync | `npm run boot` | Executes `scripts/boot-sync.js` (pre-start tasks) |
| Database sync | `npm run sync` | Executes `scripts/sync-db.js` |
| Database backup | `npm run backup` | Executes `scripts/backup.js` |

---

## API Overview

All routes are defined in the `routes/` directory and handled by controllers in `controllers/`. A typical resource follows this pattern:

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/<resource>` | List all records |
| `GET` | `/api/<resource>/:id` | Get a single record |
| `POST` | `/api/<resource>` | Create a new record |
| `PUT` | `/api/<resource>/:id` | Update an existing record |
| `DELETE` | `/api/<resource>/:id` | Delete a record |

> Check the individual files inside `routes/` for the full list of available endpoints and any authentication requirements.

---

## Contributing

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: describe your change"`
4. Push to your branch: `git push origin feature/your-feature`
5. Open a Pull Request

Please keep commits focused and write clear PR descriptions.

---

## License

This project does not currently have a license. Add a `LICENSE` file to define usage and distribution rights.
