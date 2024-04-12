import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { Navigation } from 'react-native-navigation';
import App from './App';
import {AppRegistry} from 'react-native';

//AppRegistry.registerComponent = (key, func) => registerRootComponent(func(), key);

AppRegistry.registerComponent('main', () => App);

Navigation.registerComponent('main', () => App);

Navigation.events().registerAppLaunchedListener(() => {
    Navigation.setRoot({
        root: {
          stack: {
            children: [
              {
                component: {
                  id: '123-test',
                  name: 'main',
                }
              }
            ]
          }
        }
    });
});
//AppRegistry.registerComponent('main', () => App);
// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
//registerRootComponent(App, 'main');
