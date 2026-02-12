# ResourceManager

A comprehensive invoice management system built with .NET 8, React 19, and PostgreSQL, featuring zero-downtime Blue-Green deployment.

## 🚀 Quick Start

### Development
```bash
# Start PostgreSQL
docker-compose -f docker-compose.dev.yml up -d

# Run backend
dotnet run

# Run frontend (in another terminal)
cd ClientApp && npm install && npm run dev
```

### Production (Traditional)
```bash
# Start all services
docker-compose up -d
```

### Production (Blue-Green Deployment) ⭐ NEW
```bash
# Zero-downtime deployment with instant rollback
docker-compose -f docker-compose.blue-green.yml up -d
./scripts/deploy-blue-green.sh
```

## 📚 Documentation

### General Documentation
- **[Setup Guide](SETUP_GUIDE.md)** - Complete setup and deployment instructions
- **[Development Guide](#)** - Local development setup and best practices

### Blue-Green Deployment 🔵🟢
- **[Architecture Diagrams](ARCHITECTURE.md)** - Visual system architecture and flow diagrams
- **[Full Deployment Guide](BLUE_GREEN_DEPLOYMENT.md)** - Complete Blue-Green deployment documentation
- **[Quick Reference](QUICK_REFERENCE.md)** - Command cheatsheet and troubleshooting
- **[Deployment Scripts](scripts/)** - Automated deployment and rollback scripts

## ✨ Features

### Core Functionality
- 📄 **Invoice Management** - Create, edit, and manage invoices
- 👥 **Client Management** - Track clients and customer information
- 📦 **Delivery Notes** - Generate and manage delivery documentation
- 💰 **Quotes (Devis)** - Create professional quotes
- 📊 **Dashboard** - Analytics and overview
- 📱 **Multi-tenant** - Complete company isolation
- 🔐 **Authentication** - JWT-based authentication
- 📧 **Email Integration** - Send invoices via email
- 🖨️ **PDF Generation** - Professional invoice PDFs

### DevOps Features
- 🔵🟢 **Blue-Green Deployment** - Zero-downtime deployments
- 🔄 **Instant Rollback** - < 30 second rollback capability
- 🏥 **Health Checks** - Automated health monitoring
- 📈 **Monitoring** - Built-in health endpoints
- 🐳 **Docker** - Fully containerized
- 🔁 **CI/CD** - GitHub Actions integration

## 🏗️ Architecture

### Technology Stack
- **Backend**: .NET 8, Entity Framework Core, PostgreSQL
- **Frontend**: React 19, Vite, TailwindCSS, React Query
- **Infrastructure**: Docker, Nginx, GitHub Actions
- **Deployment**: Blue-Green with zero downtime

### Blue-Green Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│                   VPS Server                        │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │            Nginx (Port 80)                    │ │
│  │         Dynamic Upstream Routing              │ │
│  └─────────────────┬─────────────────────────────┘ │
│                    │                                │
│       ┌────────────┴─────────────┐                  │
│       ▼                          ▼                  │
│  ┌──────────────┐          ┌──────────────┐        │
│  │ Blue Stack   │          │ Green Stack  │        │
│  │ - API (7175) │          │ - API (7176) │        │
│  │ - Web (8080) │          │ - Web (8081) │        │
│  └──────┬───────┘          └──────┬───────┘        │
│         │                         │                 │
│         └───────────┬─────────────┘                 │
│                     ▼                                │
│            ┌────────────────┐                        │
│            │  PostgreSQL    │                        │
│            │  (Shared)      │                        │
│            └────────────────┘                        │
└─────────────────────────────────────────────────────┘
```

**Key Benefits:**
- ⚡ **Zero Downtime** - < 0.1 second traffic switch
- 🔄 **Instant Rollback** - Revert in < 30 seconds
- ✅ **Safe Deployments** - Test before switching traffic
- 💰 **Cost Efficient** - No Kubernetes required

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed diagrams.

## 🔵🟢 Blue-Green Deployment

### Quick Deploy
```bash
# Automated deployment with health checks
./scripts/deploy-blue-green.sh

# The script will:
# 1. Deploy to inactive environment (Blue or Green)
# 2. Run health checks
# 3. Switch Nginx traffic (< 0.1s downtime)
# 4. Monitor new environment for 5 minutes
# 5. Stop old environment after verification
```

### Quick Rollback
```bash
# Instant rollback to previous version
./scripts/rollback-blue-green.sh

# Emergency rollback (< 10 seconds)
sed -i 's/ACTIVE_ENV=green/ACTIVE_ENV=blue/' .env
docker exec nginx nginx -s reload
```

### Health Checks
```bash
# Overall health
curl http://localhost/health

# Check which environment is active
curl -I http://localhost/health | grep X-Deployment-Env

# Direct environment health
curl http://localhost:7175/health  # Blue API
curl http://localhost:7176/health  # Green API
```

### Deployment Workflow

```
1. Code pushed to main branch
   ↓
2. GitHub Actions builds Docker images
   ↓
3. Images pushed to GitHub Container Registry
   ↓
4. SSH to VPS and run deploy-blue-green.sh
   ↓
5. Deploy to inactive environment (Blue or Green)
   ↓
6. Health checks (API + Web + Database)
   ↓
7. Switch Nginx traffic (< 0.1s downtime)
   ↓
8. Monitor for 5 minutes
   ↓
9. Stop old environment
   ↓
✅ Deployment complete!
```

## 📦 Project Structure

```
ResourceManager/
├── Controllers/              # API endpoints
├── Data/                    # EF Core context + migrations
├── Models/                  # Domain entities
├── Services/                # Business logic
├── Dtos/                    # Data transfer objects
├── ClientApp/               # React frontend
│   ├── src/
│   │   ├── pages/          # React pages
│   │   ├── components/     # Reusable components
│   │   ├── hooks/          # React Query hooks
│   │   └── services/       # API client
│   ├── Dockerfile          # Frontend container
│   └── nginx.conf          # Frontend nginx config
├── nginx/                   # Blue-Green nginx configs
│   └── blue-green.conf     # Dynamic routing config
├── scripts/                 # Deployment automation
│   ├── deploy-blue-green.sh    # Zero-downtime deploy
│   └── rollback-blue-green.sh  # Instant rollback
├── docker-compose.yml       # Traditional deployment
├── docker-compose.blue-green.yml  # Blue-Green deployment
├── Dockerfile              # Backend container
├── ARCHITECTURE.md         # System architecture diagrams
├── BLUE_GREEN_DEPLOYMENT.md    # Full deployment guide
├── QUICK_REFERENCE.md      # Command cheatsheet
└── SETUP_GUIDE.md          # Setup instructions
```

## 🛠️ Development

### Prerequisites
- .NET SDK 8.0+
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (via Docker)

### Local Setup
```bash
# Clone repository
git clone <repo-url>
cd ResourceManager

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Start PostgreSQL
docker-compose -f docker-compose.dev.yml up -d

# Apply migrations
dotnet ef database update

# Run backend
dotnet run

# Run frontend (new terminal)
cd ClientApp
npm install
npm run dev
```

### Test Account
- Email: `AHT@gmail.com`
- Password: `AHT@gmail.com`

## 🚢 Deployment

### Option 1: Traditional Deployment
```bash
docker-compose up -d
```

### Option 2: Blue-Green Deployment (Recommended)
```bash
# Initial setup
docker-compose -f docker-compose.blue-green.yml up -d postgres_db blue-api blue-web nginx

# Deploy updates
./scripts/deploy-blue-green.sh

# Rollback if needed
./scripts/rollback-blue-green.sh
```

### CI/CD
The project includes GitHub Actions workflows:
- **[ci.yml](.github/workflows/ci.yml)** - Build and test
- **[deploy.yml](.github/workflows/deploy.yml)** - Traditional deployment
- **[deploy-blue-green.yml](.github/workflows/deploy-blue-green.yml)** - Blue-Green deployment ⭐

## 📊 Monitoring

### Health Endpoints
```bash
# Application health
curl http://localhost/health

# API health
curl http://localhost/api/health

# Environment status
curl -I http://localhost/health | grep X-Deployment-Env
```

### Container Status
```bash
# View all containers
docker-compose -f docker-compose.blue-green.yml ps

# View logs
docker-compose -f docker-compose.blue-green.yml logs -f blue-api
docker-compose -f docker-compose.blue-green.yml logs -f green-api

# Resource usage
docker stats
```

## 🔧 Troubleshooting

### Deployment Issues
See [BLUE_GREEN_DEPLOYMENT.md](BLUE_GREEN_DEPLOYMENT.md#troubleshooting) for detailed troubleshooting.

### Quick Fixes
```bash
# Check which environment is active
grep ACTIVE_ENV .env

# Restart nginx
docker exec nginx nginx -s reload

# View container logs
docker-compose -f docker-compose.blue-green.yml logs [service-name]

# Emergency rollback
./scripts/rollback-blue-green.sh
```

## 📖 Additional Resources

### Documentation
- [Architecture Diagrams](ARCHITECTURE.md) - Visual system diagrams
- [Blue-Green Deployment Guide](BLUE_GREEN_DEPLOYMENT.md) - Complete deployment docs
- [Quick Reference](QUICK_REFERENCE.md) - Command cheatsheet
- [Setup Guide](SETUP_GUIDE.md) - Setup instructions

### Scripts
- [deploy-blue-green.sh](scripts/deploy-blue-green.sh) - Automated deployment
- [rollback-blue-green.sh](scripts/rollback-blue-green.sh) - Instant rollback

### Configuration
- [docker-compose.blue-green.yml](docker-compose.blue-green.yml) - Blue-Green orchestration
- [nginx/blue-green.conf](nginx/blue-green.conf) - Dynamic routing
- [.env.example](.env.example) - Environment variables template

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (including Blue-Green deployment)
5. Submit a pull request

## 📄 License

[Your License Here]

## 🙋 Support

For issues or questions:
- Check [BLUE_GREEN_DEPLOYMENT.md](BLUE_GREEN_DEPLOYMENT.md#troubleshooting)
- Check [QUICK_REFERENCE.md](QUICK_REFERENCE.md#troubleshooting)
- Open a GitHub issue
- Contact the development team

---

**⭐ New**: Blue-Green deployment with zero-downtime and instant rollback!

See [BLUE_GREEN_DEPLOYMENT.md](BLUE_GREEN_DEPLOYMENT.md) for the complete guide.
