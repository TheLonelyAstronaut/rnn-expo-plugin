# React Native Navigation Expo Plugin 🍉
Config plugin to auto configure `react-native-navigation` by Wix!

## Install

> Tested against Expo SDK 49

```
yarn add rnn-expo-plugin
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
        "rnn-expo-plugin"
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
