import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface FuriganaTextProps {
  text: string;
  reading: string;
  style?: any;
}

export const FuriganaText: React.FC<FuriganaTextProps> = ({ text, reading, style }) => {
  // A simple implementation: if reading exists, put it above the text.
  // In a more complex app, we would parse kanji/kana boundaries to align them properly,
  // but for this prototype, we'll just center the whole reading above the whole text.
  
  return (
    <View style={[styles.container, style]}>
      {reading ? (
        <Text style={styles.ruby} selectable>{reading}</Text>
      ) : null}
      <Text style={styles.text} selectable>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 2,
  },
  ruby: {
    fontSize: 10,
    color: '#888',
    marginBottom: -2, // pull it closer to the main text
  },
  text: {
    fontSize: 18,
    color: '#fff', // assuming dark mode for bottom sheet
  },
});
