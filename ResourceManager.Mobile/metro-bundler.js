const Metro = require('metro');
const path = require('path');
const { getDefaultConfig } = require('@expo/metro-config');

const config = {
  ...getDefaultConfig(__dirname),
  // Completely disable problematic external bundling
  resetCache: true,
  server: {
    port: 8081,
    // Disable watch folders to avoid path issues
    watchFolders: [],
    // Disable server enhancements that cause issues
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        // Block any requests to problematic external modules
        if (req.url && (req.url.includes('node:sea') || req.url.includes('noded:sea'))) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        return middleware(req, res, next);
      };
    },
  },
  // Configure resolver to avoid issues
  resolver: {
    sourceExts: ['tsx', 'ts', 'jsx', 'js', 'json'],
    assetExts: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ttf', 'otf'],
  },
  // Configure transformer
  transformer: {
    babelTransformerPath: require.resolve('@expo/metro-config/babel-transformer'),
  },
};

// Create Metro server
const { Server } = Metro;

console.log('Starting Metro bundler without external modules...');
console.log('Server running at http://localhost:8081');
console.log('This bypasses the Node.js SEA bundling issue');

const server = new Server(config, {
  watchFolders: [],
  resetCache: true,
});

server.listen();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.end();
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.end();
});
