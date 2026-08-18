import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Switch, StyleSheet, ScrollView, Button, Alert } from 'react-native';
import { useSettings, getGeminiApiKey, setGeminiApiKey, getOpenAIApiKey, setOpenAIApiKey } from '../src/store/settingsStore';

export default function SettingsScreen() {
  const { settings, updateSettings, isLoading } = useSettings();
  
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');

  useEffect(() => {
    const loadKeys = async () => {
      const gKey = await getGeminiApiKey();
      const oKey = await getOpenAIApiKey();
      if (gKey) setGeminiKey(gKey);
      if (oKey) setOpenaiKey(oKey);
    };
    loadKeys();
  }, []);

  if (isLoading) {
    return <View style={styles.container}><Text>Loading settings...</Text></View>;
  }

  const handleSaveKeys = async () => {
    await setGeminiApiKey(geminiKey);
    await setOpenAIApiKey(openaiKey);
    Alert.alert('Saved', 'API keys saved securely.');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Provider</Text>
        <View style={styles.row}>
          <Text>Use OpenAI Compatible API</Text>
          <Switch
            value={settings.aiProvider === 'openai'}
            onValueChange={(val) => updateSettings({ aiProvider: val ? 'openai' : 'gemini' })}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gemini Configuration</Text>
        <Text style={styles.label}>API Key</Text>
        <TextInput
          style={styles.input}
          value={geminiKey}
          onChangeText={setGeminiKey}
          secureTextEntry
          placeholder="AIzaSy..."
        />
        <Text style={styles.label}>Model Name</Text>
        <TextInput
          style={styles.input}
          value={settings.geminiModel}
          onChangeText={(val) => updateSettings({ geminiModel: val })}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>OpenAI Compatible Configuration</Text>
        <Text style={styles.label}>API Key</Text>
        <TextInput
          style={styles.input}
          value={openaiKey}
          onChangeText={setOpenaiKey}
          secureTextEntry
          placeholder="sk-..."
        />
        <Text style={styles.label}>Base URL</Text>
        <TextInput
          style={styles.input}
          value={settings.openaiBaseUrl}
          onChangeText={(val) => updateSettings({ openaiBaseUrl: val })}
          placeholder="https://api.openai.com/v1"
        />
        <Text style={styles.label}>Model Name</Text>
        <TextInput
          style={styles.input}
          value={settings.openaiModel}
          onChangeText={(val) => updateSettings({ openaiModel: val })}
          placeholder="gpt-4o"
        />
      </View>
      
      <Button title="Save API Keys" onPress={handleSaveKeys} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reader Settings</Text>
        <Text style={styles.label}>Reader Base URL</Text>
        <TextInput
          style={styles.input}
          value={settings.readerBaseUrl}
          onChangeText={(val) => updateSettings({ readerBaseUrl: val })}
        />
        
        <Text style={styles.label}>Japanese Level & Context</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          value={settings.japaneseLevel}
          onChangeText={(val) => updateSettings({ japaneseLevel: val })}
          multiline
          placeholder="E.g., I know hiragana, katakana, and about 300 kanji. I am studying for N4."
        />
      </View>
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  section: { backgroundColor: 'white', padding: 16, borderRadius: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 14, color: '#333', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 8, marginBottom: 12 },
});
