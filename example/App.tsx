import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

let test = 1;

export default function App() {
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
