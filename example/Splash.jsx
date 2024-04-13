import { Image } from 'react-native';
import { preloadedSplashImage } from './splash-image';
import R, { useSharedValue } from 'react-native-reanimated';

export const Splash = () => {
    const test = useSharedValue(0);

    return (
        <R.Image
            source={preloadedSplashImage}
            style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'blue'
            }}
        />
    )
}