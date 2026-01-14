# HomeCam Hub 🎥

A self-hosted, Docker-based CCTV platform with NestJS backend, React frontend, and Tapo camera integration.

## Features

- **Self-Hosted:** Full privacy, runs on your own hardware.
- **Unified Dashboard:** View and control all your cameras in one place.
- **Tapo Integration:** Seamless integration with TP-Link Tapo cameras (PTZ control, presets).
- **ONVIF Support:** Standard support for other IP cameras.
- **NVR Capabilities:** Continuous or motion-based recording with retention policies.
- **Modern UI:** Responsive React frontend with dark mode.

## 🚀 Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/home-cam-hub.git
    cd home-cam-hub
    ```

2.  **Configure Environment:**
    Copy the example environment file and update with your credentials:
    ```bash
    cp .env.example .env
    ```
    
    Edit `.env` and set:
    - `DB_PASSWORD`: Secure password for PostgreSQL.
    - `JWT_SECRET`: Random string for authentication security.
    - `TAPO_EMAIL` / `TAPO_PASSWORD`: Your Tapo cloud credentials (required for Tapo API).
    - `TAPO_API_PASSWORD`: A password you choose for the internal Tapo service.

3.  **Start the Application:**
    Run the stack using Docker Compose:
    ```bash
    cd infra
    docker compose --env-file ../.env up -d --build
    ```

4.  **Initialize Database:**
    Once containers are running, push the schema and seed initial data:
    ```bash
    docker compose exec -T backend npx prisma db push
    docker compose exec -T backend npm run prisma:seed
    ```

5.  **Access the Dashboard:**
    Open [http://localhost](http://localhost) in your browser.
    
    **Default Credentials:**
    - Username: `admin`
    - Password: `changeme123`

## 🏗️ Architecture

- **Frontend:** React, Vite, Tailwind-like CSS, HLS.js
- **Backend:** NestJS, Prisma (PostgreSQL), Passport (JWT)
- **Streaming:** MediaMTX (RTSP to HLS transcoding)
- **Tapo Service:** `tapo-rest` Docker service for camera control

## 🛠️ Docker Operations

Manage the application with these common commands:

**Start/Update Application:**
```bash
docker compose --env-file ../.env up -d --build
```

**View Logs:**
```bash
# Follow all logs
docker compose logs -f

# Specific service (e.g., backend)
docker compose logs -f backend
```

**Stop Application:**
```bash
docker compose down
```

**Database Maintenance:**
```bash
# Open Prisma Studio (Database GUI)
# Run locally if you have Node installed:
cd backend && npx prisma studio

# Reset Database (Caution!)
docker compose exec backend npx prisma migrate reset
```

## 📄 License

MIT
