import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface FuriganaTextProps {
  text: string;
  reading: string;
  furiganaText?: string;
  style?: any;
}

const parseFurigana = (str: string) => {
  const parts: { text: string; reading?: string }[] = [];
  const regex = /\{([^|]+)\|([^}]+)\}/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: str.substring(lastIndex, match.index) });
    }
    parts.push({ text: match[1], reading: match[2] });
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < str.length) {
    parts.push({ text: str.substring(lastIndex) });
  }
  
  return parts;
};

export const FuriganaText: React.FC<FuriganaTextProps> = ({ text, reading, furiganaText, style }) => {
  const [revealed, setRevealed] = useState(false);

  if (furiganaText) {
    const parts = parseFurigana(furiganaText);
    
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => setRevealed(!revealed)} style={[styles.containerRow, style]}>
        {parts.map((part, index) => (
          <View key={index} style={styles.charContainer}>
            {part.reading ? (
              <Text style={[styles.ruby, !revealed && styles.hiddenRuby]} selectable={revealed}>{part.reading}</Text>
            ) : (
              <Text style={styles.rubyPlaceholder}> </Text>
            )}
            <Text style={styles.text} selectable>{part.text}</Text>
          </View>
        ))}
      </TouchableOpacity>
    );
  }

  // Fallback to old behavior
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => setRevealed(!revealed)} style={[styles.container, style]}>
      {reading ? (
        <Text style={[styles.ruby, !revealed && styles.hiddenRuby]} selectable={revealed}>{reading}</Text>
      ) : null}
      <Text style={styles.text} selectable>{text}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 2,
  },
  containerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  charContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  ruby: {
    fontSize: 12,
    color: '#888',
    marginBottom: -2, // pull it closer to the main text
  },
  rubyPlaceholder: {
    fontSize: 12,
    marginBottom: -2,
  },
  hiddenRuby: {
    backgroundColor: '#3a3a5e',
    color: 'transparent',
    borderRadius: 2,
    overflow: 'hidden',
  },
  text: {
    fontSize: 20,
    color: '#fff', // assuming dark mode for bottom sheet
  },
});
