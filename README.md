# HomeCam Hub 🎥

A robust, self-hosted CCTV Management Platform built with NestJS, React, and MediaMTX.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=flat&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

## ✨ Features

-   **Live Streaming:** Low-latency HLS streaming via MediaMTX.
-   **PTZ Control:** Full Pan-Tilt-Zoom control for supported cameras (Tapo/ONVIF).
-   **Recording Playback:** visual timeline for viewing recorded footage.
-   **User Management:** Role-based access control (Admin/User/Viewer).
-   **Camera Management:** Easy discovery and configuration of ONVIF and Tapo devices.
-   **Modern UI:** Responsive design built with Shadcn UI and Tailwind CSS.
-   **Audit Logging:** Detailed tracking of user actions and system events.
-   **Health Monitoring:** Real-time status checks for camera connectivity and stream health.

## 🛠️ Tech Stack

-   **Frontend:** React (Vite), TypeScript, Tailwind CSS, Shadcn UI, HLS.js
-   **Backend:** NestJS, Prisma ORM, Passport JWT, ONVIF, FFmpeg
-   **Database:** PostgreSQL 16
-   **Streaming Server:** MediaMTX (formerly rtsp-simple-server)
-   **Infrastructure:** Docker Compose, Nginx Reverse Proxy

## 🚀 Getting Started

### Prerequisites

-   [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed
-   Git installed

### Installation & Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/lordeaster/home-cam-hub.git
    cd home-cam-hub
    ```

2.  **Environment Setup**
    Copy the example environment file in the `infra` directory:
    ```bash
    cd infra
    cp .env.example .env
    ```
    
    Edit `infra/.env` and configure your settings:
    - `DB_PASSWORD`: Set a secure database password.
    - `JWT_SECRET`: Generate a long random string for session security.
    - `TAPO_EMAIL` / `TAPO_PASSWORD`: (Optional) Your Tapo Cloud cedentials for discovery.
    - `RECORDINGS_HOST_PATH`: Absolute path on your host machine to store video recordings (e.g., `E:\recordings` on Windows or `/mnt/recordings` on Linux).

3.  **Start the Application**
    From the `infra` directory, run:
    ```bash
    docker compose --env-file .env up -d --build
    ```

4.  **Initialize Database**
    Once the containers are running (check with `docker compose ps`), initialize the schema and seed default data:
    ```bash
    docker compose exec -T backend npx prisma db push
    docker compose exec -T backend npm run prisma:seed
    ```

5.  **Access the Dashboard**
    Open your browser and navigate to:
    **http://localhost:7701**

    **Default Credentials:**
    -   **Email:** `admin@localhost`
    -   **Username:** `admin`
    -   **Password:** `changeme123`

## 📂 Project Structure

```
home-cam-hub/
├── backend/                # NestJS API Server
│   ├── src/
│   │   ├── modules/        # Feature modules (Cameras, Auth, Users, etc.)
│   │   └── prisma/         # Database schema and seed scripts
│   └── Dockerfile
├── frontend/               # React Web Application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Application routes
│   │   └── api/            # API client
│   └── Dockerfile
├── infra/                  # Infrastructure Configuration
│   ├── docker-compose.yml  # Container orchestration
│   ├── mediamtx.yml        # Streaming server config
│   └── nginx.conf          # Reverse proxy config
└── README.md
```

## 🔧 Troubleshooting

### Stream not loading?
-   Ensure MediaMTX is running: `docker compose logs mediamtx`
-   Check if the camera is online and reachable from the Docker network.
-   Verify RTSP credentials in the Camera Settings.

### Database connection errors?
-   Ensure the `DB_PASSWORD` in `infra/.env` matches the password used by the Postgres container.
-   If you changed the password, you may need to delete the `postgres_data` volume to reset the DB: `docker volume rm infra_postgres_data`.

## 🚧 Roadmap & Known Limitations

-   [ ] **User Profile Management:** Change password and reset password functionality is not yet implemented.
-   [ ] **Mobile App:** Native mobile application for iOS and Android.
-   [ ] **Cloud Backup:** Optional cloud storage integration for critical events.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
