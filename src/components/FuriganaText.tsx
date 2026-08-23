import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface FuriganaTextProps {
  text: string;
  reading?: string;
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
      const textPart = str.substring(lastIndex, match.index);
      for (const char of textPart) {
        parts.push({ text: char });
      }
    }
    parts.push({ text: match[1], reading: match[2] });
    lastIndex = regex.lastIndex;
  }
  
  if (lastIndex < str.length) {
    const textPart = str.substring(lastIndex);
    for (const char of textPart) {
      parts.push({ text: char });
    }
  }
  
  return parts;
};

const FuriganaPart = ({ part }: { part: { text: string; reading?: string } }) => {
  const [revealed, setRevealed] = useState(false);

  if (part.reading) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => setRevealed(!revealed)} style={styles.charContainer}>
        <Text style={[styles.ruby, !revealed && styles.hiddenRuby]} selectable={revealed}>{part.reading}</Text>
        <Text style={styles.text} selectable>{part.text}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.charContainer}>
      <Text style={styles.rubyPlaceholder}>あ</Text>
      <Text style={styles.text} selectable>{part.text}</Text>
    </View>
  );
};

export const FuriganaText: React.FC<FuriganaTextProps> = ({ text, reading, furiganaText, style }) => {
  if (furiganaText) {
    const parts = parseFurigana(furiganaText);
    
    return (
      <View style={[styles.containerRow, style]}>
        {parts.map((part, index) => (
          <FuriganaPart key={index} part={part} />
        ))}
      </View>
    );
  }

  // Fallback to old behavior
  return (
    <View style={[styles.containerRow, style]}>
      <FuriganaPart part={{ text, reading }} />
    </View>
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
    fontSize: 14,
    color: '#888',
    marginBottom: -2, // pull it closer to the main text
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rubyPlaceholder: {
    fontSize: 14,
    marginBottom: -2,
    borderWidth: 1,
    borderColor: 'transparent',
    opacity: 0,
  },
  hiddenRuby: {
    backgroundColor: '#3a3a5e',
    color: '#3a3a5e',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#7a7a9a',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  text: {
    fontSize: 26,
    color: '#fff', // assuming dark mode for bottom sheet
  },
});
