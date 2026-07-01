# 📖 Step-by-Step Guide: How to Run HIREWORK

Welcome to **HIREWORK**! This guide walks you through setting up and running the project step-by-step from scratch.

---

## 📋 System Prerequisites

Before starting, make sure you have installed on your computer:

1. **Node.js (v18.0.0 or higher, v20+ recommended)**
   - Download: https://nodejs.org/
   - Verify in terminal:
     ```bash
     node -v
     npm -v
     ```

2. **MongoDB Database**
   - **Option A (Easiest - Cloud):** Free [MongoDB Atlas](https://www.mongodb.com/atlas) connection string (e.g., `mongodb+srv://...`).
   - **Option B (Local):** [MongoDB Community Server](https://www.mongodb.com/try/download/community) installed and running locally on port 27017 (`mongodb://localhost:27017/hirework`).

---

## 🚀 Step 1: Open Terminal in Project Folder

Extract this ZIP file to your computer. Open your terminal or command prompt (PowerShell / Command Prompt on Windows, Terminal on macOS/Linux) inside the extracted `hirework-freelance-marketplace` folder:

```bash
cd hirework-freelance-marketplace
```

You should see these folders and files:
- `backend/`
- `frontend/`
- `package.json`
- `HOW_TO_RUN.md`

---

## ⚙️ Step 2: Set Up Environment Variables

### 2.1 Backend Environment:
Navigate into `backend` (or stay in root) and copy `.env.example` to `.env`:

- **Windows (PowerShell):**
  ```powershell
  Copy-Item backend\.env.example backend\.env
  ```
- **Windows (Command Prompt):**
  ```cmd
  copy backend\.env.example backend\.env
  ```
- **macOS / Linux:**
  ```bash
  cp backend/.env.example backend/.env
  ```

Open `backend/.env` in any text editor (VS Code, Notepad, etc.) and check:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/hirework
JWT_SECRET=hirework_super_secure_jwt_secret_key_2026_xyz123
CLIENT_URL=http://localhost:5173
```
*(If you are using MongoDB Atlas, replace `MONGO_URI` with your Atlas connection string).*

---

### 2.2 Frontend Environment:
Copy `.env.example` to `.env` in the `frontend` folder:

- **Windows (PowerShell):**
  ```powershell
  Copy-Item frontend\.env.example frontend\.env
  ```
- **Windows (Command Prompt):**
  ```cmd
  copy frontend\.env.example frontend\.env
  ```
- **macOS / Linux:**
  ```bash
  cp frontend/.env.example frontend/.env
  ```

The default values inside `frontend/.env` are ready to go:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## 📦 Step 3: Install Dependencies

From the project root folder, run:

```bash
npm run install:all
```

*This automatically installs dependencies for root, backend, and frontend with `--legacy-peer-deps`.*

*(Alternative: You can also `cd backend && npm install`, then `cd ../frontend && npm install`).*

---

## 🌱 Step 4: Seed Sample Data (Users, Projects, Gigs)

Populate your database with ready-to-test accounts, active projects with bids, and freelance gigs:

From the project root folder:
```bash
npm run seed
```

*(Or from `backend/` folder: `node seeders/seed.js`)*

You will see:
```text
✅ Database connected successfully!
✅ Verified sample users seeded.
✅ Sample projects seeded with bids.
✅ Sample gigs seeded with reviews.
🎉 Seed completed successfully!
```

---

## 💻 Step 5: Start the Application

You can run both Backend and Frontend together with one simple command:

```bash
npm run dev
```

Or run them in two separate terminal windows if preferred:

### Terminal 1 (Backend API):
```bash
npm run server
```
- API will be live at: **http://localhost:5000**
- Health check: **http://localhost:5000/health**

### Terminal 2 (Frontend Client):
```bash
npm run client
```
- Web application will be live at: **http://localhost:5173**

---

## 🔑 Step 6: Test Login with Demo Accounts

Open your browser and navigate to: **http://localhost:5173/login**

On the login page, you will find **1-Click Sample Login Buttons** for instant access without typing:

| Account Type | Email | Password | What You Can Do |
|---|---|---|---|
| **Client** | `client@hirework.com` | `Password@123` | Post new projects, review proposals, hire freelancers, manage milestones |
| **Freelancer** | `freelancer@hirework.com` | `Password@123` | Browse jobs, submit proposals, manage gigs, live chat, track earnings |
| **Administrator** | `admin@hirework.com` | `Password@123` | Manage users, verify KYC documents, monitor disputes & stats |

---

## 🏗️ Step 7: Production Build & Deployment (Optional)

### Single Full-Stack Server Build:
To build the frontend and serve it directly through the Express backend on port 5000:
```bash
npm run build
npm start
```
Then visit **http://localhost:5000**.

### Docker Deployment:
If you have Docker and Docker Compose installed:
```bash
docker-compose up -d --build
```
This automatically sets up MongoDB, Backend, and Frontend in isolated containers.

---

## ❓ Troubleshooting & FAQs

1. **`MongoDB connection error`**:
   - Ensure MongoDB is running locally (`mongod` or MongoDB Windows Service) OR paste a valid MongoDB Atlas connection string into `backend/.env`.

2. **`Port 5000 or 5173 already in use`**:
   - Change `PORT=5001` in `backend/.env` and update `VITE_API_URL=http://localhost:5001/api` and `VITE_SOCKET_URL=http://localhost:5001` in `frontend/.env`.

3. **Peer dependency warnings during npm install**:
   - The included `.npmrc` file handles legacy peer dependencies automatically. If installing manually, add `--legacy-peer-deps`.

Enjoy building with **HIREWORK**!
