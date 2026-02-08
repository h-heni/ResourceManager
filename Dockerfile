# ============================================
# ResourceManager API - Multi-stage Dockerfile
# ============================================
# Build: docker build -t ResourceManager-api .
# Run:   docker run -p 8080:8080 --env-file .env ResourceManager-api
# ============================================

# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
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

# Copy everything else
COPY . .

# Build the application
RUN dotnet build ResourceManager.API.csproj -c Release -o /app/build

# Stage 2: Publish
FROM build AS publish
RUN dotnet publish ResourceManager.API.csproj -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Create non-root user for security
RUN adduser --disabled-password --gecos "" appuser

# Copy published files
COPY --from=publish /app/publish .

# Copy wwwroot for static files (logo, etc.)
COPY wwwroot ./wwwroot

# Create logs directory
RUN mkdir -p /app/Logs && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port (Kestrel default)
EXPOSE 8080

# Environment variables (override in docker-compose or runtime)
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Entry point
ENTRYPOINT ["dotnet", "ResourceManager.API.dll"]
