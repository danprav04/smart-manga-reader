import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SettingsProvider } from '../src/store/settingsStore';
import { BreakdownProvider } from '../src/store/breakdownStore';
import { initDatabase } from '../src/services/databaseService';
import { View, Text } from 'react-native';

export default function RootLayout() {
  const [dbInitialized, setDbInitialized] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(() => setDbInitialized(true))
      .catch(e => console.error("Database initialization failed", e));
  }, []);

  if (!dbInitialized) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Initializing...</Text></View>;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <BreakdownProvider>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="statistics" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="history" options={{ headerShown: false, presentation: 'modal' }} />
          </Stack>
        </BreakdownProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}
