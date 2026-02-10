# ============================================
# ResourceManager API - Multi-stage Dockerfile
# ============================================
# Build: docker build -t resourcemanager-api .
# Run:   docker run -p 8080:8080 --env-file .env resourcemanager-api
# ============================================

# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src

# Copy solution and project files first (for layer caching)
COPY ResourceManager.sln ./
COPY ResourceManager.API.csproj ./
COPY ResourceManager.Domain/ResourceManager.Domain.csproj ./ResourceManager.Domain/
COPY ResourceManager.Application/ResourceManager.Application.csproj ./ResourceManager.Application/
COPY ResourceManager.Infrastructure/ResourceManager.Infrastructure.csproj ./ResourceManager.Infrastructure/
COPY ResourceManager.Tests/ResourceManager.Tests.csproj ./ResourceManager.Tests/

# Restore dependencies
RUN dotnet restore ResourceManager.API.csproj

# Copy everything else (exclude Mobile via .dockerignore)
COPY . .

# Publish in one step (skip separate build for smaller layers)
FROM build AS publish
RUN dotnet publish ResourceManager.API.csproj -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime (Alpine for minimal image size ~110MB vs ~220MB Debian)
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime
WORKDIR /app

# Install native dependencies required by SkiaSharp/QuestPDF + Tesseract OCR + curl for healthcheck
RUN apk add --no-cache \
    icu-libs \
    fontconfig \
    freetype \
    libstdc++ \
    tesseract-ocr \
    curl

# Create non-root user for security
RUN adduser -D -u 1001 appuser

# Copy published files
COPY --from=publish /app/publish .

# Copy wwwroot for static files (logo, etc.)
COPY wwwroot ./wwwroot

# Create logs and data directories
RUN mkdir -p /app/Logs /app/Data && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port (Kestrel default)
EXPOSE 8080

# Environment variables (override in docker-compose or runtime)
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
# Required for ICU globalization on Alpine
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Entry point
ENTRYPOINT ["dotnet", "ResourceManager.API.dll"]
