import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { Navigation } from 'react-native-navigation';
import App from './App';
import {AppRegistry} from 'react-native';

Navigation.registerComponent('test', () => App);
Navigation.registerComponent('test2', () => App);

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
              }
            ]
          }
        }
    });
});
