import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Switch, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, useColorScheme } from 'react-native';
import { useSettings, getGeminiApiKey, setGeminiApiKey, getOpenAIApiKey, setOpenAIApiKey } from '../src/store/settingsStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
export default function SettingsScreen() {
  const { settings, updateSettings, isLoading } = useSettings();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const colorScheme = useColorScheme();
  const isDark = settings.darkMode;
  
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
    return <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}><Text style={isDark ? styles.textDark : styles.textLight}>Loading settings...</Text></View>;
  }

  const handleSaveKeys = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await setGeminiApiKey(geminiKey);
    await setOpenAIApiKey(openaiKey);
    Alert.alert('Saved', 'API keys saved securely.');
  };

  const themeStyles = {
    container: isDark ? styles.containerDark : styles.containerLight,
    section: isDark ? styles.sectionDark : styles.sectionLight,
    text: isDark ? styles.textDark : styles.textLight,
    textSecondary: isDark ? styles.textSecondaryDark : styles.textSecondaryLight,
    input: isDark ? styles.inputDark : styles.inputLight,
    borderColor: isDark ? '#333' : '#E5E5E5',
    placeholderTextColor: isDark ? '#666' : '#999',
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        style={[styles.container, themeStyles.container]} 
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, themeStyles.text]}>Settings</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, themeStyles.textSecondary]}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, themeStyles.section]}>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={[styles.labelBold, themeStyles.text]}>Use OpenAI Compatible API</Text>
            <Switch
              value={settings.aiProvider === 'openai'}
              onValueChange={(val) => {
                Haptics.selectionAsync();
                updateSettings({ aiProvider: val ? 'openai' : 'gemini' });
              }}
              trackColor={{ false: '#767577', true: '#208AEF' }}
              thumbColor={'#fff'}
            />
          </View>
        </View>

        <View style={[styles.section, themeStyles.section]}>
          <Text style={[styles.sectionTitle, themeStyles.text]}>Gemini Configuration</Text>
          
          <Text style={[styles.label, themeStyles.textSecondary]}>API Key</Text>
          <TextInput
            style={[styles.input, themeStyles.input, { borderColor: themeStyles.borderColor }]}
            value={geminiKey}
            onChangeText={setGeminiKey}
            secureTextEntry
            placeholder="AIzaSy..."
            placeholderTextColor={themeStyles.placeholderTextColor}
          />
          
          <Text style={[styles.label, themeStyles.textSecondary]}>Model Name</Text>
          <TextInput
            style={[styles.input, themeStyles.input, { borderColor: themeStyles.borderColor }]}
            value={settings.geminiModel}
            onChangeText={(val) => updateSettings({ geminiModel: val })}
            placeholderTextColor={themeStyles.placeholderTextColor}
          />
          <Text style={[styles.label, themeStyles.textSecondary]}>Fast OCR Model (Two-Pass)</Text>
          <TextInput
            style={[styles.input, themeStyles.input, { borderColor: themeStyles.borderColor }]}
            value={settings.geminiFastModel}
            onChangeText={(val) => updateSettings({ geminiFastModel: val })}
            placeholderTextColor={themeStyles.placeholderTextColor}
          />
          <Text style={[styles.label, themeStyles.textSecondary]}>Fallback Sequence</Text>
          <TextInput
            style={[styles.input, themeStyles.input, { borderColor: themeStyles.borderColor, height: 80, textAlignVertical: 'top' }]}
            value={settings.geminiFallbackSequence || ''}
            onChangeText={(val) => updateSettings({ geminiFallbackSequence: val })}
            multiline
            placeholder="gemini-3.1-flash, gemini-3.5-flash..."
            placeholderTextColor={themeStyles.placeholderTextColor}
          />
        </View>

        <View style={[styles.section, themeStyles.section]}>
          <Text style={[styles.sectionTitle, themeStyles.text]}>OpenAI Compatible Configuration</Text>
          
          <Text style={[styles.label, themeStyles.textSecondary]}>API Key</Text>
          <TextInput
            style={[styles.input, themeStyles.input, { borderColor: themeStyles.borderColor }]}
            value={openaiKey}
            onChangeText={setOpenaiKey}
            secureTextEntry
            placeholder="sk-..."
            placeholderTextColor={themeStyles.placeholderTextColor}
          />
          
          <Text style={[styles.label, themeStyles.textSecondary]}>Base URL</Text>
          <TextInput
            style={[styles.input, themeStyles.input, { borderColor: themeStyles.borderColor }]}
            value={settings.openaiBaseUrl}
            onChangeText={(val) => updateSettings({ openaiBaseUrl: val })}
            placeholder="https://api.openai.com/v1"
            placeholderTextColor={themeStyles.placeholderTextColor}
          />
          
          <Text style={[styles.label, themeStyles.textSecondary]}>Model Name</Text>
          <TextInput
            style={[styles.input, themeStyles.input, { borderColor: themeStyles.borderColor }]}
            value={settings.openaiModel}
            onChangeText={(val) => updateSettings({ openaiModel: val })}
            placeholder="gpt-4o"
            placeholderTextColor={themeStyles.placeholderTextColor}
          />
          <Text style={[styles.label, themeStyles.textSecondary]}>Fast OCR Model (Two-Pass)</Text>
          <TextInput
            style={[styles.input, themeStyles.input, { borderColor: themeStyles.borderColor }]}
            value={settings.openaiFastModel}
            onChangeText={(val) => updateSettings({ openaiFastModel: val })}
            placeholder="gpt-4o-mini"
            placeholderTextColor={themeStyles.placeholderTextColor}
          />
          <Text style={[styles.label, themeStyles.textSecondary]}>Fallback Sequence</Text>
          <TextInput
            style={[styles.input, themeStyles.input, { borderColor: themeStyles.borderColor, height: 80, textAlignVertical: 'top' }]}
            value={settings.openaiFallbackSequence || ''}
            onChangeText={(val) => updateSettings({ openaiFallbackSequence: val })}
            multiline
            placeholder="gpt-4o-mini, gpt-3.5-turbo..."
            placeholderTextColor={themeStyles.placeholderTextColor}
          />
        </View>

        <View style={[styles.section, themeStyles.section]}>
          <Text style={[styles.sectionTitle, themeStyles.text]}>Appearance</Text>
          
          <View style={[styles.row, { borderBottomWidth: 0, marginBottom: 12 }]}>
            <Text style={[styles.labelBold, themeStyles.text]}>App Dark Mode</Text>
            <Switch
              value={settings.darkMode}
              onValueChange={(val) => {
                Haptics.selectionAsync();
                updateSettings({ darkMode: val });
              }}
              trackColor={{ false: '#767577', true: '#208AEF' }}
              thumbColor={'#fff'}
            />
          </View>

          <View style={[styles.row, { borderBottomWidth: 0, marginBottom: 12 }]}>
            <Text style={[styles.labelBold, themeStyles.text]}>Disable Spoilers</Text>
            <Switch
              value={settings.disableSpoilers}
              onValueChange={(val) => {
                Haptics.selectionAsync();
                updateSettings({ disableSpoilers: val });
              }}
              trackColor={{ false: '#767577', true: '#208AEF' }}
              thumbColor={'#fff'}
            />
          </View>
          
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={[styles.labelBold, themeStyles.text]}>Night Reader (Web)</Text>
            <Switch
              value={settings.nightReader}
              onValueChange={(val) => {
                Haptics.selectionAsync();
                updateSettings({ nightReader: val });
              }}
              trackColor={{ false: '#767577', true: '#208AEF' }}
              thumbColor={'#fff'}
            />
          </View>
        </View>

        <View style={[styles.section, themeStyles.section]}>
          <Text style={[styles.sectionTitle, themeStyles.text]}>Reader Settings</Text>
          
          <Text style={[styles.label, themeStyles.textSecondary]}>Reader Base URL</Text>
          <TextInput
            style={[styles.input, themeStyles.input, { borderColor: themeStyles.borderColor }]}
            value={settings.readerBaseUrl}
            onChangeText={(val) => updateSettings({ readerBaseUrl: val })}
            placeholderTextColor={themeStyles.placeholderTextColor}
          />
          
          <Text style={[styles.label, themeStyles.textSecondary]}>Japanese Level & Context</Text>
          <TextInput
            style={[styles.input, themeStyles.input, { borderColor: themeStyles.borderColor, height: 100, textAlignVertical: 'top' }]}
            value={settings.japaneseLevel}
            onChangeText={(val) => updateSettings({ japaneseLevel: val })}
            multiline
            placeholder="E.g., I know hiragana, katakana, and about 300 kanji. I am studying for N4."
            placeholderTextColor={themeStyles.placeholderTextColor}
          />
        </View>

        <View style={[styles.section, themeStyles.section]}>
          <Text style={[styles.sectionTitle, themeStyles.text]}>Daily Goals</Text>

          <Text style={[styles.label, themeStyles.textSecondary]}>Daily Page Goal</Text>
          <View style={[styles.row, { marginBottom: 16 }]}>
            <Text style={[styles.labelBold, themeStyles.text]}>Pages per day to maintain streak</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                style={[styles.stepperBtn, { opacity: settings.goalSettings.dailyPageGoal <= 1 ? 0.3 : 1 }]}
                onPress={() => {
                  if (settings.goalSettings.dailyPageGoal > 1) {
                    Haptics.selectionAsync();
                    updateSettings({ goalSettings: { ...settings.goalSettings, dailyPageGoal: settings.goalSettings.dailyPageGoal - 1 } });
                  }
                }}
                disabled={settings.goalSettings.dailyPageGoal <= 1}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={[styles.stepperValue, themeStyles.text]}>{settings.goalSettings.dailyPageGoal}</Text>
              <TouchableOpacity
                style={[styles.stepperBtn, { opacity: settings.goalSettings.dailyPageGoal >= 20 ? 0.3 : 1 }]}
                onPress={() => {
                  if (settings.goalSettings.dailyPageGoal < 20) {
                    Haptics.selectionAsync();
                    updateSettings({ goalSettings: { ...settings.goalSettings, dailyPageGoal: settings.goalSettings.dailyPageGoal + 1 } });
                  }
                }}
                disabled={settings.goalSettings.dailyPageGoal >= 20}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.row, { borderBottomWidth: 0, marginBottom: 12 }]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.labelBold, themeStyles.text]}>Streak Freeze</Text>
              <Text style={[{ fontSize: 13, marginTop: 2 }, themeStyles.textSecondary]}>Forgive one missed day per week</Text>
            </View>
            <Switch
              value={settings.goalSettings.streakFreezeEnabled}
              onValueChange={(val) => {
                Haptics.selectionAsync();
                updateSettings({ goalSettings: { ...settings.goalSettings, streakFreezeEnabled: val } });
              }}
              trackColor={{ false: '#767577', true: '#208AEF' }}
              thumbColor={'#fff'}
            />
          </View>

          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[styles.labelBold, themeStyles.text]}>Question Check Model</Text>
              <Text style={[{ fontSize: 13, marginTop: 2 }, themeStyles.textSecondary]}>Model used for checking answers</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 0 }}>
              <TouchableOpacity
                style={[styles.segmentBtn, styles.segmentBtnLeft, settings.goalSettings.questionCheckModel === 'main' && styles.segmentBtnActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  updateSettings({ goalSettings: { ...settings.goalSettings, questionCheckModel: 'main' } });
                }}
              >
                <Text style={[styles.segmentBtnText, settings.goalSettings.questionCheckModel === 'main' && styles.segmentBtnTextActive]}>Main</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, styles.segmentBtnRight, settings.goalSettings.questionCheckModel === 'fast' && styles.segmentBtnActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  updateSettings({ goalSettings: { ...settings.goalSettings, questionCheckModel: 'fast' } });
                }}
              >
                <Text style={[styles.segmentBtnText, settings.goalSettings.questionCheckModel === 'fast' && styles.segmentBtnTextActive]}>Fast</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        <View style={[styles.section, themeStyles.section]}>
          <Text style={[styles.sectionTitle, themeStyles.text]}>Data & Statistics</Text>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#34C759' }]} 
            onPress={() => router.push('/statistics')}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>View Learning Statistics</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSaveKeys} activeOpacity={0.8}>
          <Text style={styles.saveButtonText}>Save API Keys</Text>
        </TouchableOpacity>
        
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerDark: { backgroundColor: '#000000' },
  containerLight: { backgroundColor: '#F2F2F7' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingHorizontal: 4 },
  headerTitle: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  closeBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(150,150,150,0.15)', borderRadius: 16 },
  closeBtnText: { fontSize: 16, fontWeight: '600' },

  section: { borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(150,150,150,0.1)' },
  sectionDark: { backgroundColor: '#1C1C1E' },
  sectionLight: { backgroundColor: '#FFFFFF' },
  
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16, letterSpacing: -0.3 },
  
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  
  labelBold: { fontSize: 16, fontWeight: '500' },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8, marginTop: 4 },
  
  textDark: { color: '#FFFFFF' },
  textLight: { color: '#000000' },
  
  textSecondaryDark: { color: '#EBEBF5' },
  textSecondaryLight: { color: '#3C3C43' },
  
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16, marginBottom: 16 },
  inputDark: { backgroundColor: '#2C2C2E', color: '#FFFFFF' },
  inputLight: { backgroundColor: '#F2F2F7', color: '#000000' },

  fallbackContainer: { marginTop: -4, marginBottom: 16, padding: 12, backgroundColor: 'rgba(150,150,150,0.05)', borderRadius: 10 },
  fallbackTitle: { fontSize: 13, fontWeight: '600', marginBottom: 6, opacity: 0.8 },
  fallbackText: { fontSize: 13, opacity: 0.6, marginBottom: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  saveButton: { backgroundColor: '#208AEF', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 8, marginBottom: 40, shadowColor: '#208AEF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  actionButton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  stepperBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(150,150,150,0.2)', justifyContent: 'center', alignItems: 'center' },
  stepperBtnText: { fontSize: 20, fontWeight: '600', color: '#208AEF' },
  stepperValue: { fontSize: 24, fontWeight: '700', minWidth: 32, textAlign: 'center' },

  segmentBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(150,150,150,0.15)' },
  segmentBtnLeft: { borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  segmentBtnRight: { borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  segmentBtnActive: { backgroundColor: '#208AEF' },
  segmentBtnText: { fontSize: 14, fontWeight: '600', color: '#999' },
  segmentBtnTextActive: { color: '#FFFFFF' },
});
