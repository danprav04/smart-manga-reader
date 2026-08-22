import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { getVocabularyStatistics, getGrammarStatistics } from '../src/services/databaseService';
import { useSettings } from '../src/store/settingsStore';

type Tab = 'vocabulary' | 'grammar';

export default function StatisticsScreen() {
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const isDark = settings.darkMode;
  
  const [activeTab, setActiveTab] = useState<Tab>('vocabulary');
  const [vocabStats, setVocabStats] = useState<any[]>([]);
  const [grammarStats, setGrammarStats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    await Promise.resolve();
    setIsLoading(true);
    try {
      const vocab = await getVocabularyStatistics();
      const grammar = await getGrammarStatistics();
      setVocabStats(vocab);
      setGrammarStats(grammar);
    } catch (error) {
      console.error("Failed to load statistics", error);
      Alert.alert("Error", "Failed to load statistics.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExport = () => {
    Alert.alert(
      "Export Statistics",
      "Choose an export format",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Export as CSV", onPress: () => performExport('csv') },
        { text: "Export as JSON", onPress: () => performExport('json') }
      ]
    );
  };

  const escapeCSV = (str: string) => {
    if (!str) return '""';
    const escaped = str.toString().replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const performExport = async (format: 'json' | 'csv') => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      let content = '';
      const filename = `manga_reader_statistics_${Date.now()}.${format}`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      if (format === 'json') {
        const data = {
          vocabulary: vocabStats,
          grammar: grammarStats
        };
        content = JSON.stringify(data, null, 2);
      } else {
        // CSV Format
        content += "VOCABULARY\n";
        content += "Word,Reading,Meaning,Count\n";
        vocabStats.forEach(v => {
          content += `${escapeCSV(v.word)},${escapeCSV(v.reading)},${escapeCSV(v.meaning)},${v.count}\n`;
        });
        
        content += "\nGRAMMAR\n";
        content += "Pattern,Explanation,Count\n";
        grammarStats.forEach(g => {
          content += `${escapeCSV(g.pattern)},${escapeCSV(g.explanation)},${g.count}\n`;
        });
      }

      await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, { UTI: format === 'json' ? 'public.json' : 'public.comma-separated-values-text' });
      } else {
        Alert.alert("Sharing not available", "Your device does not support sharing files.");
      }
    } catch (error) {
      console.error("Export failed", error);
      Alert.alert("Export Error", "Failed to export statistics.");
    }
  };

  const themeStyles = {
    container: isDark ? styles.containerDark : styles.containerLight,
    text: isDark ? styles.textDark : styles.textLight,
    textSecondary: isDark ? styles.textSecondaryDark : styles.textSecondaryLight,
    card: isDark ? styles.cardDark : styles.cardLight,
    tabActive: isDark ? styles.tabActiveDark : styles.tabActiveLight,
    tabInactive: isDark ? styles.tabInactiveDark : styles.tabInactiveLight,
    tabTextActive: isDark ? styles.tabTextActiveDark : styles.tabTextActiveLight,
    tabTextInactive: isDark ? styles.tabTextInactiveDark : styles.tabTextInactiveLight,
  };

  const renderVocabItem = ({ item }: { item: any }) => (
    <View style={[styles.card, themeStyles.card]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.wordText, themeStyles.text]}>{item.word}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{item.count}</Text>
        </View>
      </View>
      <Text style={[styles.readingText, themeStyles.textSecondary]}>{item.reading}</Text>
      <Text style={[styles.meaningText, themeStyles.text]}>{item.meaning}</Text>
    </View>
  );

  const renderGrammarItem = ({ item }: { item: any }) => (
    <View style={[styles.card, themeStyles.card]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.wordText, themeStyles.text]}>{item.pattern}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{item.count}</Text>
        </View>
      </View>
      <Text style={[styles.meaningText, themeStyles.text]}>{item.explanation}</Text>
    </View>
  );

  return (
    <View style={[styles.container, themeStyles.container, { paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, themeStyles.text]}>Statistics</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleExport} style={[styles.actionBtn, { marginRight: 8 }]}>
            <Text style={[styles.actionBtnText, themeStyles.textSecondary]}>Export</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.actionBtn}>
            <Text style={[styles.actionBtnText, themeStyles.textSecondary]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'vocabulary' ? themeStyles.tabActive : themeStyles.tabInactive]} 
          onPress={() => setActiveTab('vocabulary')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'vocabulary' ? themeStyles.tabTextActive : themeStyles.tabTextInactive]}>
            Vocabulary ({vocabStats.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'grammar' ? themeStyles.tabActive : themeStyles.tabInactive]} 
          onPress={() => setActiveTab('grammar')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'grammar' ? themeStyles.tabTextActive : themeStyles.tabTextInactive]}>
            Grammar ({grammarStats.length})
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : (
        <FlatList
          data={activeTab === 'vocabulary' ? vocabStats : grammarStats}
          keyExtractor={(item, index) => `${activeTab}-${index}`}
          renderItem={activeTab === 'vocabulary' ? renderVocabItem : renderGrammarItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={[styles.emptyText, themeStyles.textSecondary]}>No statistics found yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerDark: { backgroundColor: '#000000' },
  containerLight: { backgroundColor: '#F2F2F7' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 16 },
  headerTitle: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row' },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(150,150,150,0.15)', borderRadius: 16 },
  actionBtnText: { fontSize: 16, fontWeight: '600' },

  tabsContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, marginHorizontal: 4 },
  tabActiveDark: { backgroundColor: '#2C2C2E' },
  tabActiveLight: { backgroundColor: '#E5E5EA' },
  tabInactiveDark: { backgroundColor: 'transparent' },
  tabInactiveLight: { backgroundColor: 'transparent' },
  
  tabText: { fontSize: 16, fontWeight: '600' },
  tabTextActiveDark: { color: '#FFFFFF' },
  tabTextActiveLight: { color: '#000000' },
  tabTextInactiveDark: { color: '#8E8E93' },
  tabTextInactiveLight: { color: '#8E8E93' },

  listContent: { paddingHorizontal: 16, flexGrow: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16 },

  card: { borderRadius: 12, padding: 16, marginBottom: 12 },
  cardDark: { backgroundColor: '#1C1C1E' },
  cardLight: { backgroundColor: '#FFFFFF' },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  wordText: { fontSize: 20, fontWeight: 'bold', flex: 1, marginRight: 8 },
  readingText: { fontSize: 14, marginBottom: 8 },
  meaningText: { fontSize: 16, lineHeight: 22 },
  
  countBadge: { backgroundColor: '#208AEF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  countText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },

  textDark: { color: '#FFFFFF' },
  textLight: { color: '#000000' },
  textSecondaryDark: { color: '#EBEBF5' },
  textSecondaryLight: { color: '#3C3C43' },
});
