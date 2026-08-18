module.exports = ({ config }) => {
  const IS_DEV = process.env.APP_VARIANT === 'development';
  
  return {
    ...config,
    name: IS_DEV ? 'Smart Manga Reader (Dev)' : 'Smart Manga Reader',
    slug: 'smart-manga-reader',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'smartmangareader',
    userInterfaceStyle: 'automatic',
    ios: {
      icon: './assets/expo.icon',
      bundleIdentifier: IS_DEV ? 'com.smartmangareader.dev' : 'com.smartmangareader'
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png'
      },
      predictiveBackGestureEnabled: false,
      package: IS_DEV ? 'com.smartmangareader.dev' : 'com.smartmangareader'
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png'
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#208AEF',
          image: './assets/images/splash-icon.png',
          imageWidth: 76
        }
      ],
      'expo-secure-store',
      'expo-sqlite',
      'expo-file-system'
    ],
    extra: {
      eas: {
        projectId: "98370e37-515d-4174-b1e0-19168b78b5b9"
      }
    },
    experiments: {
      typedRoutes: true,
      reactCompiler: true
    }
  };
};
