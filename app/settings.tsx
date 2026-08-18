import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Switch, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, useColorScheme } from 'react-native';
import { useSettings, getGeminiApiKey, setGeminiApiKey, getOpenAIApiKey, setOpenAIApiKey } from '../src/store/settingsStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { closeDatabase, initDatabase } from '../src/services/databaseService';
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

  const handleExportDatabase = async () => {
    try {
      const dbPath = `${FileSystem.documentDirectory}SQLite/smartmanga.db`;
      const fileInfo = await FileSystem.getInfoAsync(dbPath);
      
      if (!fileInfo.exists) {
        Alert.alert('Error', 'Database file does not exist yet.');
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Error', 'Sharing is not available on this device.');
        return;
      }

      await Sharing.shareAsync(dbPath, {
        mimeType: 'application/x-sqlite3',
        dialogTitle: 'Export Smart Manga Reader Database',
      });
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'Failed to export the database.');
    }
  };

  const handleImportDatabase = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/x-sqlite3', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const fileUri = result.assets[0].uri;
      
      Alert.alert(
        'Confirm Import',
        'This will overwrite your current database. Are you sure you want to proceed?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Import', 
            style: 'destructive',
            onPress: async () => {
              try {
                // Close current connection
                await closeDatabase();
                
                const dbPath = `${FileSystem.documentDirectory}SQLite/smartmanga.db`;
                
                // Make sure SQLite directory exists
                const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
                const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
                if (!dirInfo.exists) {
                  await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
                }

                // Copy picked file to DB path
                await FileSystem.copyAsync({
                  from: fileUri,
                  to: dbPath,
                });
                
                // Re-initialize database
                await initDatabase();
                
                Alert.alert('Success', 'Database imported successfully!');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (err) {
                console.error('Import process error:', err);
                Alert.alert('Error', 'Failed to replace database file.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Import Failed', 'Failed to select the database file.');
    }
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
          <Text style={[styles.label, themeStyles.textSecondary]}>Fallback Sequence</Text>
          <TextInput
            style={[styles.input, themeStyles.input, { borderColor: themeStyles.borderColor, height: 80, textAlignVertical: 'top' }]}
            value={settings.geminiFallbackSequence || ''}
            onChangeText={(val) => updateSettings({ geminiFallbackSequence: val })}
            multiline
            placeholder="gemini-3.7-flash, gemini-3.6-flash..."
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
          <Text style={[styles.sectionTitle, themeStyles.text]}>Data Management</Text>
          <TouchableOpacity style={[styles.actionButton, isDark ? styles.actionButtonDark : styles.actionButtonLight]} onPress={handleExportDatabase}>
            <Text style={[styles.actionButtonText, themeStyles.text]}>Export Database</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, isDark ? styles.actionButtonDark : styles.actionButtonLight, { marginTop: 12 }]} onPress={handleImportDatabase}>
            <Text style={[styles.actionButtonText, themeStyles.text]}>Import Database</Text>
          </TouchableOpacity>
          <Text style={[styles.helperText, themeStyles.textSecondary, { marginTop: 12 }]}>
            Export your database to backup your saved pages, translations, and vocabulary. Importing a database will overwrite your current data.
          </Text>
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
  
  actionButton: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  actionButtonDark: { backgroundColor: '#2C2C2E', borderColor: '#333' },
  actionButtonLight: { backgroundColor: '#F2F2F7', borderColor: '#E5E5E5' },
  actionButtonText: { fontSize: 16, fontWeight: '500' },
  helperText: { fontSize: 13, opacity: 0.7, lineHeight: 18 },
});
