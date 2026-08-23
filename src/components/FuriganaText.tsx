import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface FuriganaTextProps {
  text: string;
  reading?: string;
  furiganaText?: string;
  forceReveal?: boolean;
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

const FuriganaPart = ({ part, forceReveal }: { part: { text: string; reading?: string }, forceReveal?: boolean }) => {
  const [revealed, setRevealed] = useState(false);
  const isRevealed = revealed || forceReveal;

  return (
    <TouchableOpacity 
      activeOpacity={part.reading && !forceReveal ? 0.8 : 1} 
      onPress={() => part.reading && !forceReveal && setRevealed(!revealed)} 
      style={styles.charContainer}
    >
      <View style={styles.rubyContainer}>
        {part.reading ? (
          <Text style={[styles.ruby, !isRevealed && styles.hiddenRuby]} selectable={isRevealed}>
            {part.reading}
          </Text>
        ) : null}
      </View>
      <Text style={styles.text} selectable>{part.text}</Text>
    </TouchableOpacity>
  );
};

export const FuriganaText: React.FC<FuriganaTextProps> = ({ text, reading, furiganaText, forceReveal, style }) => {
  if (furiganaText) {
    const parts = parseFurigana(furiganaText);
    
    return (
      <View style={[styles.containerRow, style]}>
        {parts.map((part, index) => (
          <FuriganaPart key={index} part={part} forceReveal={forceReveal} />
        ))}
      </View>
    );
  }

  // Fallback to old behavior
  return (
    <View style={[styles.containerRow, style]}>
      <FuriganaPart part={{ text, reading }} forceReveal={forceReveal} />
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
  rubyContainer: {
    height: 18,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 2,
  },
  ruby: {
    fontSize: 14,
    color: '#888',
    lineHeight: 16,
    marginHorizontal: 1,
  },
  hiddenRuby: {
    backgroundColor: '#383854',
    color: '#383854',
    borderRadius: 3,
    overflow: 'hidden',
  },
  text: {
    fontSize: 26,
    lineHeight: 32,
    color: '#fff', // assuming dark mode for bottom sheet
  },
});
