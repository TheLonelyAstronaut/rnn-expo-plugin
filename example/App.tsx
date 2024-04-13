import { hideAsync, preventAutoHideAsync } from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

let test = 1;
let wasSplashHidden = false;

export default function App() {
  useEffect(() => {
    if (!wasSplashHidden) {
      wasSplashHidden = true;
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app! {test}</Text>
      <Button title='Generate!' onPress={() => test = Math.random() * 1000}/>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
