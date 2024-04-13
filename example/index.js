import 'react-native-gesture-handler';
import './splash-image';
import { registerRootComponent } from 'expo';
import { Navigation } from 'react-native-navigation';
import App from './App';
import {AppRegistry} from 'react-native';
import { Splash } from './Splash';
import { preventAutoHideAsync } from 'expo-splash-screen';

//registerRootComponent(App)

Navigation.registerComponent('test', () => App);
Navigation.registerComponent('test2', () => App);
Navigation.registerComponent('splash', () => Splash);

Navigation.setDefaultOptions({
  animations: {
      setRoot: {
          waitForRender: true
      }
  }
});

Navigation.events().registerAppLaunchedListener(() => {
    Navigation.setRoot({
        root: {
          stack: {
            children: [
              {
                component: {
                  name: 'test',
                }
              },
              {
                component: {
                  name: 'test2',
                }
              },
              {
                component: {
                  name: 'splash',
                  options: {
                    topBar: {
                      visible: false
                    }
                  }
                }
              }
            ]
          }
        }
    });
});
