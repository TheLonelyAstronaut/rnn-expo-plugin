# React Native Navigation Expo Plugin 🧭
Config plugin to auto configure `react-native-navigation` by Wix!
This config changes internal source code of Expo SDK before prebuild, save your code before testing this lib to do not lose your progress.

## Important: Expo Splash Screen usage

There are some limitations in Expo Splash Screen usage. See details below.

## Install

> Tested against Expo SDK 49 and SDK 50

```
yarn add rnn-expo-plugin react-native-navigation
```

> Please make sure you also install   **[expo-build-properties](https://docs.expo.dev/versions/latest/sdk/build-properties/)**

After installing this npm package, add the [config plugin](https://docs.expo.io/guides/config-plugins/) to the [`plugins`](https://docs.expo.io/versions/latest/config/app/#plugins) array of your `app.json` or `app.config.js`. Then rebuild your app using a custom development client, as described in the ["Adding custom native code"](https://docs.expo.io/workflow/customizing/) guide.

You also need to add the packaging options pick-first for android.

## Example

In your app.json `plugins` array:

```json
{
  "plugins": [
      [
        "rnn-expo-plugin",
        {
          "setupAndroidSplash": true
        }
      ],
      [
        "expo-build-properties",
        {
          "android": {
            "kotlinVersion": "1.8.0",
            "packagingOptions": {
              "pickFirst": [
                "**/libc++_shared.so"
              ]
            }
          }
        }
      ]
  ]
}
```

## Usage with Fabic and New Architecture (SDK 50)

Use following config (ap.json):
```json
{
  "plugins": [
      "rnn-expo-plugin",
      [
        "expo-build-properties",
        {
          "ios": {
            "newArchEnabled": true
          },
          "android": {
            "kotlinVersion": "1.8.0",
            "newArchEnabled": true,
            "packagingOptions": {
              "pickFirst": [
                "**/libc++_shared.so",
                "**/libreact_utils.so"
              ]
            }
          }
        }
      ]
  ]
}
```

## Expo Splash Screen usage

React Navigation (and Expo Router) renders your app in single Activity/UIViewController, that's why you could use `preventAutoHideAsync()` and `hideAsync()` functions. However, RNN uses native navigation approach (One screen - one Activity/Fragment/UIViewController), and after initialization it automatically hides SplashScreen activity, so `preventAutoHideAsync()` and `hideAsync()` functions becomes useless.

As a workaround, you could use this approach:
```jsx
// index.js

// Register screens
Navigation.registerComponent('home', () => Home);
Navigation.registerComponent('splash', () => Splash);

// Telling RNN that we dont want to hide native splash before RN finishes initial render, this helps to remove white flashes/glitches
Navigation.setDefaultOptions({
  animations: {
      setRoot: {
          waitForRender: true
      }
  }
});

// Register splash as single "JS" screen, similar to 'preventAutoHideAsync'
Navigation.events().registerAppLaunchedListener(() => {
    Navigation.showModal({
        component: {
            name: 'splash',
            options: {
                topBar: {
                    visible: false
                },
                animations: {
                    showModal: {
                        enabled: false
                    }
                },
                modalPresentationStyle: 'overFullScreen'
            }
        }
    });
});

// Splash.tsx
// Changing navigation tree (similar to hideAsync())
function onLoadEnd() {
    Navigation.setRoot({
      root: {
        stack: {
          children: [
            {
              component: {
                name: 'home',
              },
            },
          ],
        },
      },
    });
}

export const Splash = () => {
  useEffect(() => {
    // Do some logic here, ex. check logged in state
    // ..
    // Trigger to navigation tree change
    onLoadEnd();
  }, []);

  return (
        <Image
            source={preloadedSplashImage}
            style={{
                width: '100%',
                height: '100%'
            }}
        />
  );
};
```
To remove white glitches on Android, pass this parameter to plugin config (app.json):
```json
  [
    "rnn-expo-plugin",
    { "setupAndroidSplash": true }
  ]
```

## Monorepos (Nx and other)

Due to 'common node_nodules' monorepo pattern, there are some troubles with linking library headers. If you use monorepo solution, specify path to RNNAppDelegate.h file in app.json, for example:

```json
  [
    "rnn-expo-plugin",
    { "monorepoPathForDelegateHeader": "../../../ReactNativeNavigation/ReactNativeNavigation.framework/Headers/RNNAppDelegate.h" }
  ]
```
Will be removed in future versions and this process will be automated.

## Build errors with M1 architectures for simulators

There have been errors building with M1 architectures for simulators on iOS, with Error:

```
No such module 'ExpoModulesCore' 
```

This plugin will NOT add the `arm64` in  `Exlcuded_Archs`, If you wish to add the above in configuration, you can add it with option:

```json
  [
    "rnn-expo-plugin",
    { "excludeSimArch": true }
  ]
```
