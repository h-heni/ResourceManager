module.exports = function (api) {
  api.cache(true);
  const isProd = process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production';
  return {
    presets: ['babel-preset-expo'],
    // Strip console.* calls from production builds so secrets / tokens are never
    // emitted to logcat / Console.app on shipped APK/IPA.
    plugins: isProd ? [['transform-remove-console', { exclude: ['error', 'warn'] }]] : [],
  };
};
