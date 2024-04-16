import {
  withXcodeProject,
  withDangerousMod,
  withProjectBuildGradle,
  withMainApplication,
  withMainActivity,
  ExportedConfigWithProps,
} from "@expo/config-plugins";
import { ExpoConfig } from "@expo/config-types";
import filesys from "fs";
import { insertLinesHelper } from "./insertLinesHelper";

const fs = filesys.promises;

type Options = {
  excludeSimArch?: boolean;
  setupAndroidSplash?: boolean;
  monorepoPathForDelegateHeader?: string;
}
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
    if (
      typeof (buildSettings === null || buildSettings === void 0
        ? void 0
        : buildSettings.PRODUCT_NAME) !== "undefined"
    ) {
      buildSettings['"EXCLUDED_ARCHS[sdk=iphonesimulator*]"'] = '"arm64"';
    }
  }

  return project;
}

const withExcludedSimulatorArchitectures = (c: ExpoConfig) : ExpoConfig => {
  return withXcodeProject(c, (config) => {
    config.modResults = setExcludedArchitectures(config.modResults);
    return config;
  }) as ExpoConfig;
};

async function prepareAppDelegate(path: string) {
  const contents = await fs.readFile(path, "utf-8");

  let updated = insertLinesHelper(
    `// Initial content was removed by rnn-expo-plugin (1)`, 
    `self.moduleName = @"main";`,
    contents,
    0,
    1
  );

  updated = insertLinesHelper(
    `// Initial content was removed by rnn-expo-plugin (2)`, 
    `self.initialProps = @{};`,
    updated,
    0,
    1
  );

  await fs.writeFile(path, updated);
}

async function swapCoreModulesDelegate(path: string, headerPath: string) {
  const contents = await fs.readFile(path, "utf-8");

  let updated = insertLinesHelper(
    headerPath,
    "#import <ExpoModulesCore/EXReactDelegateWrapper.h>",
    contents
  );

  updated = insertLinesHelper(
    '@interface EXAppDelegateWrapper: RNNAppDelegate',
    "@interface EXAppDelegateWrapper : RCTAppDelegate",
    updated,
    0,
    1
  );

  await fs.writeFile(path, updated);
}

async function editExpoTypedefs(path: string) {
  const contents = await fs.readFile(path, "utf-8");

  const updated = insertLinesHelper(
    "export default function registerRootComponent<P extends InitialProps>(component: React.ComponentType<P>, key?: string): void;",
    'export default function registerRootComponent<P extends InitialProps>(component: React.ComponentType<P>): void;',
    contents,
    0,
    1
  );

  await fs.writeFile(path, updated);
}

async function editExpoAppRegistry(path: string) {
  const contents = await fs.readFile(path, "utf-8");

  let updated = insertLinesHelper(
    "export default function registerRootComponent(component, key) {",
    'export default function registerRootComponent(component) {',
    contents,
    0,
    1
  );

  updated = insertLinesHelper(
    "AppRegistry.registerComponent(key ?? 'main', () => qualifiedComponent)",
    "AppRegistry.registerComponent('main', () => qualifiedComponent)",
    updated,
    0,
    1
  );

  await fs.writeFile(path, updated);
}

async function swapRNNAppRegistry(path: string) {
  const contents = await fs.readFile(path, "utf-8");

  let updated = insertLinesHelper(
    'const expo_1 = require("expo");',
    'const react_native_1 = require("react-native");',
    contents,
    0,
    1
  );

  updated = insertLinesHelper(
    "expo_1.registerRootComponent(getComponentFunc(), appKey);",
    "react_native_1.AppRegistry.registerComponent(appKey, getComponentFunc);",
    updated,
    0,
    1
  );

  await fs.writeFile(path, updated);
}

function modifyCoreDependencies(config: ExportedConfigWithProps) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const root = config.modRequest.projectRoot;
      const corePath = `${root}/node_modules/expo/build/launch/`;
      const rnnLibPath = `${root}/node_modules/react-native-navigation/lib/`

      await editExpoTypedefs(corePath + 'registerRootComponent.d.ts');
      await editExpoAppRegistry(corePath + 'registerRootComponent.js');
      await swapRNNAppRegistry(rnnLibPath + 'dist/src/adapters/AppRegistryService.js')

      return config;
    },
  ]);
}

function configureIOSSDK50(_config: ExpoConfig, options: Options) {
  return withDangerousMod(_config, [
    "ios",
    async (config) => {
      const root = config.modRequest.projectRoot;
      const rnnPath = `${root}/node_modules/react-native-navigation/lib/ios/RNNReactView.mm`;
      const iosModulesCorePath = `${root}/node_modules/expo-modules-core/ios/AppDelegates/EXAppDelegateWrapper.mm`;

      let contents = await fs.readFile(rnnPath, "utf-8");

      let updated = insertLinesHelper(
        "  [surface start];",
        "self = [super initWithSurface:surface sizeMeasureMode:sizeMeasureMode];",
        contents,
        0,
        1
      );

      await fs.writeFile(rnnPath, updated);

      contents = await fs.readFile(iosModulesCorePath, "utf-8");

      // it's safe, cause we have guard preprocessor, that wraps this line
      updated = insertLinesHelper(
        "  enableFabric = YES;",
        "enableFabric = self.fabricEnabled;",
        contents
      );

      await fs.writeFile(iosModulesCorePath, updated);

      return config;
    },
  ]);
}

function configureIOS(_config: ExpoConfig, options: Options) {
  return withDangerousMod(_config, [
    "ios",
    async (config) => {
      const root = config.modRequest.projectRoot;
      const iosModulesCorePath = `${root}/node_modules/expo-modules-core/ios/AppDelegates/EXAppDelegateWrapper.h`;

      await prepareAppDelegate(`${config.modRequest.platformProjectRoot}/${config.modRequest.projectName}/AppDelegate.mm`)
      await swapCoreModulesDelegate(iosModulesCorePath, !!options?.monorepoPathForDelegateHeader ? `#import "${options?.monorepoPathForDelegateHeader}"` : '#import "RNNAppDelegate.h"');

      if (options?.excludeSimArch === true) {
        _config = withExcludedSimulatorArchitectures(_config);
      }

      return config;
    },
  ]);
}

function configureGradleFiles(_config: ExpoConfig, options: Options) {
  // @ts-ignore
  _config = withProjectBuildGradle(_config, (config) => {
    let content = config.modResults.contents; 

    content = insertLinesHelper(
      "        RNNKotlinVersion = kotlinVersion",
      "kotlinVersion =",
      content,
    );

    content = insertLinesHelper(
      '        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")',
      "classpath('com.facebook.react:react-native-gradle-plugin')",
      content,
    );

    config.modResults.contents = content;

    return config;
  });

  return _config;
}

function configureAndroid(_config: ExpoConfig, options: Options) {
  _config = configureGradleFiles(_config, options);

  // @ts-ignore
  _config = withMainActivity(_config, (config) => {
    let content = config.modResults.contents; 

    content = insertLinesHelper(
      "import com.reactnativenavigation.NavigationActivity;",
      "import com.facebook.react.ReactActivity;",
      content,
      0,
      1
    );

    if (options?.setupAndroidSplash === true) {
      content = insertLinesHelper(
        `import expo.modules.splashscreen.NativeResourcesBasedSplashScreenViewProvider;
import expo.modules.splashscreen.SplashScreenImageResizeMode;`,
        "import com.reactnativenavigation.NavigationActivity;",
        content,
      );

      content = insertLinesHelper(
        `    setContentView(new NativeResourcesBasedSplashScreenViewProvider(SplashScreenImageResizeMode.CONTAIN).createSplashScreenView(getApplicationContext()));`,
        "super.onCreate(null);",
        content,
      );
    }

    content = insertLinesHelper(
      'public class MainActivity extends NavigationActivity {',
      "public class MainActivity extends ReactActivity {",
      content,
      0,
      1
    );

    content = insertLinesHelper(
      '\n  // Removed by rnn-expo-plugin (1)',
      `
  @Override
  protected String getMainComponentName() {
    return "main";
  }`,
      content,
      0,
      1
    );

    content = insertLinesHelper(
      '\n  // Removed by rnn-expo-plugin (2)',
      `
  @Override
  protected ReactActivityDelegate createReactActivityDelegate() {
    return new ReactActivityDelegateWrapper(this, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED, new DefaultReactActivityDelegate(
        this,
        getMainComponentName(),
        // If you opted-in for the New Architecture, we enable the Fabric Renderer.
        DefaultNewArchitectureEntryPoint.getFabricEnabled()));
  }`,
      content,
      0,
      1
    );

    config.modResults.contents = content;

    return config;
  });

  // @ts-ignore
  _config = withMainApplication(_config, (config) => {
    let content = config.modResults.contents; 

    content = insertLinesHelper(
      `import com.reactnativenavigation.NavigationApplication;
import com.reactnativenavigation.react.NavigationReactNativeHost;`,
      "import com.facebook.react.ReactApplication;",
      content,
      0,
      1
    );

    content = insertLinesHelper(
      `public class MainApplication extends NavigationApplication  {`,
      "public class MainApplication extends Application implements ReactApplication {",
      content,
      0,
      1
    );

    content = insertLinesHelper(
      `new NavigationReactNativeHost(this) {`,
      "new ReactNativeHostWrapper(this",
      content,
      0,
      1
    );

    content = insertLinesHelper(
      `
      @Override
      protected Boolean isHermesEnabled() {
        return BuildConfig.IS_HERMES_ENABLED;
      }
  };`,
      `
      @Override
      protected Boolean isHermesEnabled() {
        return BuildConfig.IS_HERMES_ENABLED;
      }
  });`,
      content,
      0,
      1
    );

    content = insertLinesHelper(
      '// Removed by rnn-expo-plugin (1)',
      "SoLoader.init(this, /* native exopackage */ false);",
      content,
      0,
      1
    );

    config.modResults.contents = content;

    return config;
  });

  return _config;
}

function configureAndroidSDK50(_config: ExpoConfig, options: Options) {
  _config = configureGradleFiles(_config, options);

  // @ts-ignore
  _config = withMainActivity(_config, (config) => {
    let content = config.modResults.contents; 

    content = insertLinesHelper(
      "import com.reactnativenavigation.NavigationActivity",
      "import com.facebook.react.ReactActivity",
      content,
      0,
      1
    );

    if (options?.setupAndroidSplash === true) {
      content = insertLinesHelper(
        `import expo.modules.splashscreen.NativeResourcesBasedSplashScreenViewProvider
import expo.modules.splashscreen.SplashScreenImageResizeMode`,
        "import com.reactnativenavigation.NavigationActivity",
        content,
      );

      content = insertLinesHelper(
        `    contentView = NativeResourcesBasedSplashScreenViewProvider(SplashScreenImageResizeMode.CONTAIN).createSplashScreenView(applicationContext)`,
        "super.onCreate(null)",
        content,
      );
    }

    content = insertLinesHelper(
      'class MainActivity : NavigationActivity() {',
      "class MainActivity : ReactActivity() {",
      content,
      0,
      1
    );

    content = insertLinesHelper(
      '// Removed by rnn-expo-plugin (1)',
      `override fun getMainComponentName(): String = "main"`,
      content,
      0,
      1
    );

    content = insertLinesHelper(
      '\n  // Removed by rnn-expo-plugin (2)',
      `
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }`,
      content,
      0,
      1
    );

    config.modResults.contents = content;

    return config;
  });

  // @ts-ignore
  _config = withMainApplication(_config, (config) => {
    let content = config.modResults.contents; 

    content = insertLinesHelper(
      `import com.reactnativenavigation.NavigationApplication
import com.reactnativenavigation.react.NavigationReactNativeHost`,
      "import com.facebook.react.ReactApplication",
      content,
      0,
      1
    );

    content = insertLinesHelper(
      `class MainApplication : NavigationApplication()  {`,
      "class MainApplication : Application(), ReactApplication {",
      content,
      0,
      1
    );

    content = insertLinesHelper(
      `object : NavigationReactNativeHost(this) {`,
      `ReactNativeHostWrapper(
        this,
        object : DefaultReactNativeHost(this) {`,
      content,
      0,
      1
    );

    content = insertLinesHelper(
      `  override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
  }`,
      `  override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }
  )`,
      content,
      0,
      1
    );

    content = insertLinesHelper(
      '// Removed by rnn-expo-plugin (1)',
      "SoLoader.init(this, false)",
      content,
      0,
      1
    );

    config.modResults.contents = content;

    return config;
  });

  return _config;
} 

// @ts-ignore
export default (config, options) => {
  if (config.sdkVersion >= '50.0.0') {
    config = configureIOSSDK50(config, options);
    config = configureAndroidSDK50(config, options);
  } else {
    config = configureAndroid(config, options);
  }

  config = modifyCoreDependencies(config);
  config = configureIOS(config, options);

  return config;
};
