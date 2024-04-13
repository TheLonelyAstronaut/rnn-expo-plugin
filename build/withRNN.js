"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_plugins_1 = require("@expo/config-plugins");
const fs_1 = __importDefault(require("fs"));
const insertLinesHelper_1 = require("./insertLinesHelper");
const fs = fs_1.default.promises;
/**
 * Exclude building for arm64 on simulator devices in the pbxproj project.
 * Without this, production builds targeting simulators will fail.
 */
// @ts-ignore
function setExcludedArchitectures(project) {
    const configurations = project.pbxXCBuildConfigurationSection();
    // @ts-ignore
    for (const { buildSettings } of Object.values(configurations || {})) {
        // Guessing that this is the best way to emulate Xcode.
        // Using `project.addToBuildSettings` modifies too many targets.
        if (typeof (buildSettings === null || buildSettings === void 0
            ? void 0
            : buildSettings.PRODUCT_NAME) !== "undefined") {
            buildSettings['"EXCLUDED_ARCHS[sdk=iphonesimulator*]"'] = '"arm64"';
        }
    }
    return project;
}
const withExcludedSimulatorArchitectures = (c) => {
    return (0, config_plugins_1.withXcodeProject)(c, (config) => {
        config.modResults = setExcludedArchitectures(config.modResults);
        return config;
    });
};
async function prepareAppDelegate(path) {
    const contents = await fs.readFile(path, "utf-8");
    let updated = (0, insertLinesHelper_1.insertLinesHelper)(`// Initial content was removed by rnn-expo-plugin (1)`, `self.moduleName = @"main";`, contents, 0, 1);
    updated = (0, insertLinesHelper_1.insertLinesHelper)(`// Initial content was removed by rnn-expo-plugin (2)`, `self.initialProps = @{};`, updated, 0, 1);
    await fs.writeFile(path, updated);
}
async function swapCoreModulesDelegate(path) {
    const contents = await fs.readFile(path, "utf-8");
    let updated = (0, insertLinesHelper_1.insertLinesHelper)('#import "RNNAppDelegate.h"', "#import <ExpoModulesCore/EXReactDelegateWrapper.h>", contents);
    updated = (0, insertLinesHelper_1.insertLinesHelper)('@interface EXAppDelegateWrapper: RNNAppDelegate', "@interface EXAppDelegateWrapper : RCTAppDelegate", updated, 0, 1);
    await fs.writeFile(path, updated);
}
async function editExpoTypedefs(path) {
    const contents = await fs.readFile(path, "utf-8");
    const updated = (0, insertLinesHelper_1.insertLinesHelper)("export default function registerRootComponent<P extends InitialProps>(component: React.ComponentType<P>, key?: string): void;", 'export default function registerRootComponent<P extends InitialProps>(component: React.ComponentType<P>): void;', contents, 0, 1);
    await fs.writeFile(path, updated);
}
async function editExpoAppRegistry(path) {
    const contents = await fs.readFile(path, "utf-8");
    let updated = (0, insertLinesHelper_1.insertLinesHelper)("export default function registerRootComponent(component, key) {", 'export default function registerRootComponent(component) {', contents, 0, 1);
    updated = (0, insertLinesHelper_1.insertLinesHelper)("AppRegistry.registerComponent(key ?? 'main', () => qualifiedComponent)", "AppRegistry.registerComponent('main', () => qualifiedComponent)", updated, 0, 1);
    await fs.writeFile(path, updated);
}
async function swapRNNAppRegistry(path) {
    const contents = await fs.readFile(path, "utf-8");
    let updated = (0, insertLinesHelper_1.insertLinesHelper)('const expo_1 = require("expo");', 'const react_native_1 = require("react-native");', contents, 0, 1);
    updated = (0, insertLinesHelper_1.insertLinesHelper)("expo_1.registerRootComponent(getComponentFunc(), appKey);", "react_native_1.AppRegistry.registerComponent(appKey, getComponentFunc);", updated, 0, 1);
    await fs.writeFile(path, updated);
}
function modifyCoreDependencies(config) {
    return (0, config_plugins_1.withDangerousMod)(config, [
        "ios",
        async (config) => {
            const root = config.modRequest.projectRoot;
            const corePath = `${root}/node_modules/expo/build/launch/`;
            const rnnLibPath = `${root}/node_modules/react-native-navigation/lib/`;
            await editExpoTypedefs(corePath + 'registerRootComponent.d.ts');
            await editExpoAppRegistry(corePath + 'registerRootComponent.js');
            await swapRNNAppRegistry(rnnLibPath + 'dist/src/adapters/AppRegistryService.js');
            return config;
        },
    ]);
}
function configureIOS(_config, options) {
    return (0, config_plugins_1.withDangerousMod)(_config, [
        "ios",
        async (config) => {
            const root = config.modRequest.projectRoot;
            const iosModulesCorePath = `${root}/node_modules/expo-modules-core/ios/AppDelegates/EXAppDelegateWrapper.h`;
            await prepareAppDelegate(`${config.modRequest.platformProjectRoot}/${config.modRequest.projectName}/AppDelegate.mm`);
            await swapCoreModulesDelegate(iosModulesCorePath);
            if (options?.excludeSimArch === true) {
                _config = withExcludedSimulatorArchitectures(_config);
            }
            return config;
        },
    ]);
}
function configureAndroid(_config) {
    // @ts-ignore
    _config = (0, config_plugins_1.withMainActivity)(_config, (config) => {
        let content = config.modResults.contents;
        content = (0, insertLinesHelper_1.insertLinesHelper)("import com.reactnativenavigation.NavigationActivity;", "import com.facebook.react.ReactActivity;", content, 0, 1);
        content = (0, insertLinesHelper_1.insertLinesHelper)('public class MainActivity extends NavigationActivity {', "public class MainActivity extends ReactActivity {", content, 0, 1);
        content = (0, insertLinesHelper_1.insertLinesHelper)('\n  // Removed by rnn-expo-plugin (1)', `
  @Override
  protected String getMainComponentName() {
    return "main";
  }`, content, 0, 1);
        content = (0, insertLinesHelper_1.insertLinesHelper)('\n  // Removed by rnn-expo-plugin (2)', `
  @Override
  protected ReactActivityDelegate createReactActivityDelegate() {
    return new ReactActivityDelegateWrapper(this, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED, new DefaultReactActivityDelegate(
        this,
        getMainComponentName(),
        // If you opted-in for the New Architecture, we enable the Fabric Renderer.
        DefaultNewArchitectureEntryPoint.getFabricEnabled()));
  }`, content, 0, 1);
        config.modResults.contents = content;
        return config;
    });
    // @ts-ignore
    _config = (0, config_plugins_1.withProjectBuildGradle)(_config, (config) => {
        let content = config.modResults.contents;
        content = (0, insertLinesHelper_1.insertLinesHelper)("        RNNKotlinVersion = kotlinVersion", "kotlinVersion =", content);
        content = (0, insertLinesHelper_1.insertLinesHelper)('        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")', "classpath('com.facebook.react:react-native-gradle-plugin')", content);
        config.modResults.contents = content;
        return config;
    });
    // @ts-ignore
    _config = (0, config_plugins_1.withMainApplication)(_config, (config) => {
        let content = config.modResults.contents;
        content = (0, insertLinesHelper_1.insertLinesHelper)(`import com.reactnativenavigation.NavigationApplication;
import com.reactnativenavigation.react.NavigationReactNativeHost;`, "import com.facebook.react.ReactApplication;", content, 0, 1);
        content = (0, insertLinesHelper_1.insertLinesHelper)(`public class MainApplication extends NavigationApplication  {`, "public class MainApplication extends Application implements ReactApplication {", content, 0, 1);
        content = (0, insertLinesHelper_1.insertLinesHelper)(`new NavigationReactNativeHost(this) {`, "new ReactNativeHostWrapper(this", content, 0, 1);
        content = (0, insertLinesHelper_1.insertLinesHelper)(`
      @Override
      protected Boolean isHermesEnabled() {
        return BuildConfig.IS_HERMES_ENABLED;
      }
  };`, `
      @Override
      protected Boolean isHermesEnabled() {
        return BuildConfig.IS_HERMES_ENABLED;
      }
  });`, content, 0, 1);
        content = (0, insertLinesHelper_1.insertLinesHelper)('// Removed by rnn-expo-plugin (1)', "SoLoader.init(this, /* native exopackage */ false);", content, 0, 1);
        config.modResults.contents = content;
        return config;
    });
    return _config;
}
// @ts-ignore
exports.default = (config, options) => {
    if (config.sdkVersion >= '50.0.0') {
        throw new Error('SDK 50 is not supported yet!');
    }
    ;
    config = modifyCoreDependencies(config);
    config = configureIOS(config, options);
    config = configureAndroid(config);
    return config;
};
