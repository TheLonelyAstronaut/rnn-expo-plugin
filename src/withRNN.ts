import {
  withXcodeProject,
  withDangerousMod,
  withSettingsGradle,
  withAppBuildGradle,
  withProjectBuildGradle,
  withMainApplication,
  withMainActivity,
  ExportedConfigWithProps, 
  withGradleProperties,
} from "@expo/config-plugins";
import { ExpoConfig } from "@expo/config-types";
import filesys from "fs";
import path from "path";
import resolveFrom from "resolve-from";
import { insertLinesHelper } from "./insertLinesHelper";

const fs = filesys.promises;

type Options = {
  disableJsi?: boolean;
  databases?: string[];
  excludeSimArch?: boolean;
}

/**
 * Version 50+
 *  */
function setAndroidMainApplication(config: ExportedConfigWithProps) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      // @ts-ignore
      const extension = config.sdkVersion >= '50.0.0' ? 'kt' : 'java';
      const root = config.modRequest.platformProjectRoot;
      const filePath = `${root}/app/src/main/java/${config?.android?.package?.replace(
        /\./g,
        "/"
      )}/MainApplication.${extension}`;

      const contents = await fs.readFile(filePath, "utf-8");

      let updated = insertLinesHelper(
        "import com.nozbe.watermelondb.WatermelonDBPackage;",
        "import java.util.List;",
        contents
      );

      await fs.writeFile(filePath, updated);

      return config;
    },
  ]);
}

function settingGradle(gradleConfig: ExpoConfig): ExpoConfig {
  return withSettingsGradle(gradleConfig, (mod) => {
    if (!mod.modResults.contents.includes(':watermelondb-jsi')) {
      mod.modResults.contents += `
          include ':watermelondb-jsi'
          project(':watermelondb-jsi').projectDir =
            new File(rootProject.projectDir, '../node_modules/@nozbe/watermelondb/native/android-jsi')
        `;
    }
    return mod;
  }) as ExpoConfig;
}

function buildGradle(config: ExpoConfig): ExpoConfig {
  return withAppBuildGradle(config, (mod) => {
    const newContents = mod.modResults.contents.replace(
        'dependencies {',
        `dependencies {
        implementation project(':watermelondb-jsi')
        `
    )
    mod.modResults.contents = newContents;

    return mod;
  }) as ExpoConfig;
}

const cocoaPods = (config: ExpoConfig): ExpoConfig => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const filePath = path.join(
          config.modRequest.platformProjectRoot,
          "Podfile"
      );

      const contents = await fs.readFile(filePath, "utf-8");
      const newContents=contents.replace(
          'post_install do |installer|',`
          
    # WatermelonDB dependency
    pod 'simdjson', path: '../node_modules/@nozbe/simdjson', modular_headers: true          
    
    post_install do |installer|`
      );
        await fs.writeFile(filePath, newContents);
        return config;
    },
  ]) as ExpoConfig;
};

function mainApplication(config: ExpoConfig): ExpoConfig {
  return withMainApplication(config, (mod) => {
    mod.modResults['contents'] = mod.modResults.contents.replace('import android.app.Application', `
import android.app.Application
import com.nozbe.watermelondb.jsi.WatermelonDBJSIPackage;
import com.facebook.react.bridge.JSIModulePackage;        
`);

    const newContents2 = mod.modResults.contents.replace(
        'override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED',
        `
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        override fun getJSIModulePackage(): JSIModulePackage {
        return WatermelonDBJSIPackage()
        }`
    )
    mod.modResults.contents = newContents2;

    return mod;
  }) as ExpoConfig;
}

function proGuardRules(config: ExpoConfig): ExpoConfig {
  return withDangerousMod(config, ['android', async (config) => {
    const contents = await fs.readFile(`${config.modRequest.platformProjectRoot}/app/proguard-rules.pro`, 'utf-8');
    const newContents = `
    ${contents}
    -keep class com.nozbe.watermelondb.** { *; }
    `

    await fs.writeFile(`${config.modRequest.platformProjectRoot}/app/proguard-rules.pro`, newContents);

    return config;
  }]) as ExpoConfig;
}

/**
 * Version 50+ finish
 *  */

/**
 * Platform: Android
 *  */
function addFlipperDb(config: ExpoConfig, databases: string[]) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      // short circuit if no databases specified
      if (!databases?.length) return config;

      const root = config.modRequest.platformProjectRoot;
      const filePath = `${root}/app/src/debug/java/${config?.android?.package?.replace(
        /\./g,
        "/"
      )}/ReactNativeFlipper.java`;

      const contents = await fs.readFile(filePath, "utf-8");

      // Add imports

      let updated = insertLinesHelper(
        `import com.facebook.flipper.plugins.databases.impl.SqliteDatabaseDriver;
import com.facebook.flipper.plugins.databases.impl.SqliteDatabaseProvider;
import java.io.File;
import java.util.List;
import java.util.ArrayList;`,
        "import okhttp3.OkHttpClient;",
        contents
      );

      // Replace DatabasesFlipperPlugin with custom driver

      const addDatabases = databases
        .map(
          (d) =>
            `databaseFiles.add(new File(context.getDatabasePath("${d}").getPath().replace("/databases", "")));`
        )
        .join("\n          ");

      updated = insertLinesHelper(
        `      client.addPlugin(new DatabasesFlipperPlugin(new SqliteDatabaseDriver(context, new SqliteDatabaseProvider() {
        @Override
        public List<File> getDatabaseFiles() {
          List<File> databaseFiles = new ArrayList<>();
          for (String databaseName : context.databaseList()) {
            databaseFiles.add(context.getDatabasePath(databaseName));
          }
          ${addDatabases}
          return databaseFiles;
        }
      })));`,
        "client.addPlugin(new DatabasesFlipperPlugin(context));",
        updated,
        0, // replace original plugin
        1
      );

      await fs.writeFile(filePath, updated);

      return config;
    },
  ]) as ExpoConfig;
}

function setWmelonBridgingHeader(config: ExpoConfig): ExpoConfig {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const filePath = getPlatformProjectFilePath(config, "wmelon.swift");
      const contents = `
//
//  water.swift
//  watermelonDB
//
//  Created by Watermelon-plugin on ${new Date().toLocaleDateString()}.
//

import Foundation`;

      await fs.writeFile(filePath, contents);

      return config;
    },
  ]) as ExpoConfig;
}

const withCocoaPods = (config: ExpoConfig): ExpoConfig => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const filePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );

      const contents = await fs.readFile(filePath, "utf-8");

      const watermelonPath = isWatermelonDBInstalled(
        config.modRequest.projectRoot
      );

      if (watermelonPath) {
        const patchKey = "post_install";
        const slicedContent = contents.split(patchKey);
        slicedContent[0] += `\n
  pod 'WatermelonDB', :path => '../node_modules/@nozbe/watermelondb'
  pod 'React-jsi', :path => '../node_modules/react-native/ReactCommon/jsi', :modular_headers => true
  pod 'simdjson', path: '../node_modules/@nozbe/simdjson', :modular_headers => true\n\n  `;
        await fs.writeFile(filePath, slicedContent.join(patchKey));
      } else {
        throw new Error("Please make sure you have watermelondb installed");
      }
      return config;
    },
  ]) as ExpoConfig;
};

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

function isWatermelonDBInstalled(projectRoot: string) {
  const resolved = resolveFrom.silent(
    projectRoot,
    "@nozbe/watermelondb/package.json"
  );
  return resolved ? path.dirname(resolved) : null;
}

function getPlatformProjectFilePath(
  config: ExportedConfigWithProps,
  fileName: string
) {
  const projectName =
    config.modRequest.projectName || config.name.replace(/[- ]/g, "");
  return path.join(
    config.modRequest.platformProjectRoot,
    projectName,
    fileName
  );
}

const withWatermelonDBAndroidJSI = (config: ExpoConfig, options: Options) => {
  if (options?.disableJsi === true) {
    return config;
  };

  function buildGradle(gradleConfig: ExpoConfig): ExpoConfig {
    return withAppBuildGradle(gradleConfig, (mod) => {
      if (
          !mod.modResults.contents.includes("pickFirst '**/libc++_shared.so'")
      ) {
        mod.modResults.contents = mod.modResults.contents.replace(
            'android {',
            `
          android {
            packagingOptions {
               pickFirst '**/libc++_shared.so' 
            }
          `
        );
      }
      if (
          !mod.modResults.contents.includes(
              "implementation project(':watermelondb-jsi')"
          )
      ) {
        mod.modResults.contents = mod.modResults.contents.replace(
            'dependencies {',
            `
          dependencies {
            implementation project(':watermelondb-jsi')
          `
        );
      }
      return mod;
    }) as ExpoConfig;
  }

  function mainApplication(mainAppConfig: ExpoConfig): ExpoConfig {
    return withMainApplication(mainAppConfig, (mod) => {
      if (
          !mod.modResults.contents.includes(
              'import com.nozbe.watermelondb.jsi.WatermelonDBJSIPackage;'
          )
      ) {
        mod.modResults.contents = mod.modResults.contents.replace(
            'import com.nozbe.watermelondb.WatermelonDBPackage;',
            `
          import com.nozbe.watermelondb.WatermelonDBPackage;
          import com.nozbe.watermelondb.jsi.WatermelonDBJSIPackage;
          import com.facebook.react.bridge.JSIModulePackage;
        `
        );
      }
      if (
          !mod.modResults.contents.includes('return new WatermelonDBJSIPackage()')
      ) {
        mod.modResults.contents = mod.modResults.contents.replace(
            'new ReactNativeHostWrapper(this, new DefaultReactNativeHost(this) {',
            `
          new ReactNativeHostWrapper(this, new DefaultReactNativeHost(this) {
            @Override
             protected JSIModulePackage getJSIModulePackage() {
               return new WatermelonDBJSIPackage(); 
             }
          `
        );
      }
      return mod;
    }) as ExpoConfig;
  }

  return mainApplication(settingGradle(buildGradle(config)));
};


// @ts-ignore
export function withSDK50(options: Options) {
  return (config: ExpoConfig): ExpoConfig => {
    let currentConfig: ExpoConfig = config;
    // Android
    if (options?.disableJsi !== true) {
      currentConfig = settingGradle(config);
      currentConfig = buildGradle(currentConfig);
      currentConfig = proGuardRules(currentConfig);
      currentConfig = mainApplication(currentConfig);
    }

    // iOS
    currentConfig = setWmelonBridgingHeader(currentConfig);
    currentConfig = withCocoaPods(currentConfig);
    if (options?.excludeSimArch === true) {
      currentConfig = withExcludedSimulatorArchitectures(currentConfig);
    }

    return currentConfig as ExpoConfig;
  }
}

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

async function swapCoreModulesDelegate(path: string) {
  const contents = await fs.readFile(path, "utf-8");

  let updated = insertLinesHelper(
    '#import "RNNAppDelegate.h"',
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

function configureIOS(_config: ExpoConfig, options: Options) {
  return withDangerousMod(_config, [
    "ios",
    async (config) => {
      const root = config.modRequest.projectRoot;
      const iosModulesCorePath = `${root}/node_modules/expo-modules-core/ios/AppDelegates/EXAppDelegateWrapper.h`;

      await prepareAppDelegate(`${config.modRequest.platformProjectRoot}/${config.modRequest.projectName}/AppDelegate.mm`)
      await swapCoreModulesDelegate(iosModulesCorePath);

      if (options?.excludeSimArch === true) {
        _config = withExcludedSimulatorArchitectures(_config);
      }

      return config;
    },
  ]);
}

function configureAndroid(_config: ExpoConfig) {
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

// @ts-ignore
export default (config, options) => {
  if (config.sdkVersion >= '50.0.0') {
    throw new Error('SDK 50 is not supported yet!');
  };

  config = modifyCoreDependencies(config);
  config = configureIOS(config, options);
  config = configureAndroid(config);

  return config;
};
