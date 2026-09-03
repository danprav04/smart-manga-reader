module.exports = ({ config }) => {
  const IS_DEV = process.env.APP_VARIANT === 'development';
  
  return {
    ...config,
    name: IS_DEV ? 'Smart Manga Reader (Dev)' : 'Smart Manga Reader',
    slug: 'smart-manga-reader',
    version: '1.0.1',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'smartmangareader',
    userInterfaceStyle: 'automatic',
    ios: {
      icon: './assets/images/icon.png',
      bundleIdentifier: IS_DEV ? 'com.smartmangareader.dev' : 'com.smartmangareader',
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true
        }
      }
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#FFBE98',
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
          backgroundColor: '#FFBE98',
          image: './assets/images/splash-icon.png',
          imageWidth: 200
        }
      ],
      'expo-secure-store',
      'expo-sqlite',
      'expo-file-system',
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: true
          }
        }
      ]
    ],
    extra: {
      eas: {
        projectId: "98370e37-515d-4174-b1e0-19168b78b5b9"
      }
    },
    updates: {
      url: "https://u.expo.dev/98370e37-515d-4174-b1e0-19168b78b5b9"
    },
    runtimeVersion: {
      policy: "appVersion"
    },
    experiments: {
      typedRoutes: true,
      reactCompiler: true
    }
  };
};

const { withAndroidManifest } = require('@expo/config-plugins');

const withBackgroundActions = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];

    const permissions = androidManifest.manifest['uses-permission'] || [];
    const hasPermission = (name) => permissions.some(p => p.$['android:name'] === name);
    
    if (!hasPermission('android.permission.FOREGROUND_SERVICE')) {
      permissions.push({ $: { 'android:name': 'android.permission.FOREGROUND_SERVICE' } });
    }
    if (!hasPermission('android.permission.FOREGROUND_SERVICE_DATA_SYNC')) {
      permissions.push({ $: { 'android:name': 'android.permission.FOREGROUND_SERVICE_DATA_SYNC' } });
    }
    if (!hasPermission('android.permission.WAKE_LOCK')) {
      permissions.push({ $: { 'android:name': 'android.permission.WAKE_LOCK' } });
    }
    androidManifest.manifest['uses-permission'] = permissions;

    const services = mainApplication.service || [];
    const hasService = services.some(s => s.$['android:name'] === 'com.asterinet.react.bgactions.RNBackgroundActionsTask');
    
    if (!hasService) {
      services.push({
        $: {
          'android:name': 'com.asterinet.react.bgactions.RNBackgroundActionsTask',
          'android:foregroundServiceType': 'dataSync',
        },
      });
    }
    mainApplication.service = services;

    return config;
  });
};

const originalModuleExports = module.exports;
module.exports = (config) => {
  let userConfig = originalModuleExports(config);
  return withBackgroundActions(userConfig);
};
