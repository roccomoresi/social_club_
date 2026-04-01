module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'nativewind/babel' // Mantené el de nativewind, pero borrá el de expo-router
    ],
  };
};