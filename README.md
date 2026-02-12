# ResourceManager - Invoice Management System

Complete invoice management system with .NET 8 backend, React frontend, and production-ready CI/CD pipeline.

---

## 🚀 Quick Start

### For Developers
```bash
# Clone repository
git clone <your-repo-url>
cd ResourceManager

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Start development
docker compose -f docker-compose.dev.yml up -d
dotnet ef database update
dotnet run
# In another terminal:
cd ClientApp && npm install && npm run dev
```

**👉 See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed local development setup**

### For DevOps/Production
```bash
# 1. Configure GitHub Secrets (see SECRETS.md)
# 2. Setup VPS (see DEPLOYMENT.md)
# 3. Deploy via GitHub Actions
```

**👉 See [DEPLOYMENT-CHECKLIST.md](./DEPLOYMENT-CHECKLIST.md) for step-by-step deployment**

---

## 📚 Documentation

### Quick Start Guides
| Document | Description | For |
|----------|-------------|-----|
| **[DEPLOYMENT-CHECKLIST.md](./DEPLOYMENT-CHECKLIST.md)** | ✅ Quick checklist for production deployment | DevOps, First-time deployers |
| **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** | 📋 Command cheat sheet | Everyone |
| **[PRODUCTION_DEPLOY.md](./PRODUCTION_DEPLOY.md)** | 🚀 Quick production setup (5 minutes) | DevOps |

### Comprehensive Guides
| Document | Description | For |
|----------|-------------|-----|
| **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** | 📖 Complete deployment guide with architecture | DevOps, System Admins |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | 📖 VPS deployment procedures (17K) | DevOps, System Admins |
| **[CI-CD.md](./CI-CD.md)** | 🚀 CI/CD pipeline architecture & workflows | Developers, DevOps |
| **[SECRETS.md](./SECRETS.md)** | 🔐 GitHub Secrets configuration guide | DevOps, CI/CD Setup |
| **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** | 💻 Local development setup | Developers |

### Reference Materials
| Document | Description | For |
|----------|-------------|-----|
| **[ARCHITECTURE_DIAGRAM.txt](./ARCHITECTURE_DIAGRAM.txt)** | 🏗️ Visual system architecture diagrams | Everyone |
| **[WORKFLOW-DIAGRAM.txt](./WORKFLOW-DIAGRAM.txt)** | 🔄 CI/CD workflow visualizations | DevOps |
| **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** | 📊 Configuration summary | Everyone |

---

## 🏗️ Architecture

### Tech Stack

**Backend:**
- .NET 8 Web API
- Entity Framework Core
- PostgreSQL
- JWT Authentication
- Clean Architecture (Domain/Application/Infrastructure)

**Frontend:**
- React 19
- Vite
- TypeScript
- Tailwind CSS
- React Query
- React Router

**Infrastructure:**
- Docker & Docker Compose
- Nginx (reverse proxy)
- GitHub Actions (CI/CD)
- GitHub Container Registry (GHCR)

### Project Structure

```
ResourceManager/
├── .github/workflows/        # CI/CD pipelines
│   ├── ci.yml               # Build, test, push to GHCR
│   └── deploy.yml           # Zero-downtime VPS deployment
├── Controllers/             # API endpoints
├── Data/                    # EF Core context & migrations
├── Models/                  # Domain entities
├── Services/                # Business logic
├── ResourceManager.Domain/  # Domain layer (interfaces)
├── ResourceManager.Application/ # Application services
├── ResourceManager.Infrastructure/ # Data access & external services
├── ClientApp/              # React frontend
│   ├── src/
│   │   ├── pages/          # React pages
│   │   ├── components/     # Reusable components
│   │   ├── hooks/          # React Query hooks
│   │   └── context/        # Auth context
│   ├── Dockerfile          # Frontend production image
│   └── nginx.conf          # Nginx configuration
├── Dockerfile              # Backend production image
├── docker-compose.yml      # Base configuration
├── docker-compose.prod.yml # Production overrides
└── docker-compose.dev.yml  # Development setup
```

---

## 🚢 Deployment

### CI/CD Pipeline Flow

```
Developer Push to GitHub
         │
         ▼
┌────────────────────┐
│  GitHub Actions    │
│  CI/CD Pipeline    │
└────────┬───────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌─────────┐
│ Backend │ │Frontend │
│  Build  │ │  Build  │
│  Tests  │ │  Lint   │
└────┬────┘ └────┬────┘
     │           │
     └─────┬─────┘
           ▼
    ┌─────────────┐
    │ Docker Build│
    │ & Security  │
    │   Scan      │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │Push to GHCR │
    │  (GitHub    │
    │  Container  │
    │  Registry)  │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │  Deploy to  │
    │     VPS     │
    │ (Zero Down) │
    └─────────────┘
```

### Deployment Features

✅ **Zero-Downtime Deployments**
- Rolling updates with health checks
- Automatic rollback on failure
- No service interruption

✅ **Multi-Environment Support**
- Production (manual approval)
- Staging (automatic)
- Development (local)

✅ **Security**
- Trivy vulnerability scanning
- SSH key authentication
- Secret management
- Non-root containers

✅ **Optimized for 2GB RAM VPS**
- Resource limits configured
- Log rotation enabled
- Efficient Alpine images

---

## 🔧 Configuration

### Environment Variables

See [`.env.example`](./.env.example) for all available variables.

**Minimum required:**
```env
# Database
POSTGRES_PASSWORD=your-strong-password

# JWT (generate with: openssl rand -base64 48)
JWT_KEY=your-secure-random-key-at-least-32-chars

# Docker Images (updated by CI/CD)
API_IMAGE=ghcr.io/h-heni/resourcemanager-api:latest
WEB_IMAGE=ghcr.io/h-heni/resourcemanager-web:latest
```

### GitHub Secrets

Required for CI/CD deployment:

| Secret | Description |
|--------|-------------|
| `VPS_HOST` | VPS IP address or domain |
| `VPS_USER` | SSH username (e.g., deploy) |
| `VPS_SSH_KEY` | Private SSH key for authentication |
| `GHCR_TOKEN` | GitHub Personal Access Token with `read:packages` scope (for VPS) |

**Note**: `GITHUB_TOKEN` is automatically available for pushing images to GHCR.

**👉 See [SECRETS.md](./SECRETS.md) for detailed setup instructions**

---

## 🧪 Development

### Prerequisites
- .NET 8 SDK
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL (via Docker)

### Local Development

```bash
# 1. Start database
docker compose -f docker-compose.dev.yml up -d

# 2. Apply migrations
dotnet ef database update

# 3. Start backend
dotnet run
# API runs on https://localhost:7175

# 4. Start frontend (new terminal)
cd ClientApp
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

### Test Account
- Email: `AHT@gmail.com`
- Password: `AHT@gmail.com`

### Running Tests

```bash
# Backend tests
dotnet test

# Frontend lint
cd ClientApp && npm run lint

# Frontend type check
cd ClientApp && npx tsc --noEmit
```

---

## 📦 Docker Deployment

### Local Docker Build

```bash
# Build images
docker compose build

# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

### Production Deployment

```bash
# On VPS
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check status
docker compose ps

# View logs
docker compose logs -f api
```

---

## 🛠️ Common Commands

### Backend

```bash
# Create migration
dotnet ef migrations add MigrationName

# Apply migrations
dotnet ef database update

# Restore packages
dotnet restore

# Build
dotnet build --configuration Release

# Run tests
dotnet test
```

### Frontend

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

### Docker

```bash
# View running containers
docker compose ps

# View logs
docker compose logs -f [service]

# Restart service
docker compose restart [service]

# Rebuild and restart
docker compose up -d --build

# Clean up
docker system prune -a
```

---

## 🔒 Security

### Production Checklist
- [ ] Use strong passwords (32+ characters)
- [ ] Generate secure JWT_KEY (`openssl rand -base64 48`)
- [ ] Enable HTTPS (Caddy/Let's Encrypt)
- [ ] Configure firewall (only ports 22, 80, 443)
- [ ] Use SSH keys (no password authentication)
- [ ] Disable root login
- [ ] Keep system updated
- [ ] Regular backups
- [ ] Monitor logs for suspicious activity

### Security Features
- Multi-tenant data isolation (global query filters)
- JWT token authentication
- HttpOnly cookies for refresh tokens
- Non-root container execution
- Vulnerability scanning in CI/CD
- Minimal Alpine base images
- Secret management via environment variables

---

## 📊 Monitoring

### Health Endpoints

```bash
# API health
curl http://localhost:7175/health

# Web health
curl http://localhost/health

# Database health
docker compose exec postgres_db pg_isready -U rmuser
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f web
docker compose logs -f postgres_db

# Last 100 lines
docker compose logs --tail=100 api

# Since timestamp
docker compose logs --since=2024-01-01T00:00:00 api
```

### Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df
df -h

# Memory usage
free -h
```

---

## 🚨 Troubleshooting

### Common Issues

**Database connection failed:**
```bash
docker compose ps postgres_db
docker compose logs postgres_db
```

**Port already in use:**
```bash
lsof -i :80
lsof -i :7175
```

**Out of memory:**
```bash
free -h
docker stats --no-stream
```

**Images not pulling:**
```bash
docker login ghcr.io
docker pull ghcr.io/h-heni/resourcemanager-api:latest
```

**👉 See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive troubleshooting**

---

## 📝 License

[Your License Here]

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

- **Documentation**: See guides in repository root
- **Issues**: Open an issue on GitHub
- **Questions**: Check existing issues or open a discussion

---

## 🎯 Roadmap

- [x] .NET 8 backend with clean architecture
- [x] React 19 frontend with Vite
- [x] Multi-tenant support
- [x] JWT authentication
- [x] Docker containerization
- [x] CI/CD pipeline with GitHub Actions
- [x] Zero-downtime deployments
- [x] Production deployment guide
- [ ] HTTPS/SSL setup automation
- [ ] Monitoring dashboard (Prometheus/Grafana)
- [ ] Automated backup solution
- [ ] Performance optimization
- [ ] Mobile app (.NET MAUI)

---

**Built with ❤️ for production-ready deployments**
