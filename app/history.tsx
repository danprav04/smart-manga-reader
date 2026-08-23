import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { getRecentBreakdowns, getBreakdownById } from '../src/services/databaseService';
import { useSettings } from '../src/store/settingsStore';
import { useBreakdown } from '../src/store/breakdownStore';
import { PageSummary } from '../src/types/breakdown';

export default function HistoryScreen() {
  const { settings } = useSettings();
  const { dispatch } = useBreakdown();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const isDark = settings.darkMode;
  
  const [historyItems, setHistoryItems] = useState<PageSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const items = await getRecentBreakdowns(50);
      setHistoryItems(items);
    } catch (error) {
      console.error("Failed to load history", error);
      Alert.alert("Error", "Failed to load history.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleItemPress = async (item: PageSummary) => {
    try {
      Haptics.selectionAsync();
      const breakdown = await getBreakdownById(item.id);
      if (breakdown) {
        
        let fileExists = true;
        if (breakdown.screenshotPath) {
          const info = await FileSystem.getInfoAsync(breakdown.screenshotPath);
          fileExists = info.exists;
        }

        if (!fileExists) {
          Alert.alert("Missing Screenshot", "The screenshot for this breakdown is no longer available on disk.");
        }

        dispatch({ type: 'LOAD_CACHED', payload: breakdown });
        router.back();
      } else {
        Alert.alert("Error", "Could not load the breakdown data.");
      }
    } catch (error) {
      console.error("Failed to open historical breakdown", error);
      Alert.alert("Error", "Failed to open this breakdown.");
    }
  };

  const themeStyles = {
    container: isDark ? styles.containerDark : styles.containerLight,
    text: isDark ? styles.textDark : styles.textLight,
    textSecondary: isDark ? styles.textSecondaryDark : styles.textSecondaryLight,
    card: isDark ? styles.cardDark : styles.cardLight,
  };

  const renderHistoryItem = ({ item }: { item: PageSummary }) => {
    const date = new Date(item.analyzedAt);
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity 
        style={[styles.card, themeStyles.card]} 
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        {item.screenshotPath ? (
          <Image 
            source={{ uri: item.screenshotPath }} 
            style={styles.thumbnail} 
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Text style={styles.thumbnailPlaceholderText}>No Image</Text>
          </View>
        )}
        <View style={styles.cardContent}>
          <Text style={[styles.domainText, themeStyles.text]} numberOfLines={1}>{item.siteDomain}</Text>
          <Text style={[styles.urlText, themeStyles.textSecondary]} numberOfLines={2}>{item.url}</Text>
          <Text style={[styles.timeText, themeStyles.textSecondary]}>{`${dateStr} at ${timeStr}`}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, themeStyles.container, { paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, themeStyles.text]}>History</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.actionBtn}>
          <Text style={[styles.actionBtnText, themeStyles.textSecondary]}>Done</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#208AEF" />
        </View>
      ) : (
        <FlatList
          data={historyItems}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderHistoryItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={[styles.emptyText, themeStyles.textSecondary]}>No history found.</Text>
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
  actionBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(150,150,150,0.15)', borderRadius: 16 },
  actionBtnText: { fontSize: 16, fontWeight: '600' },

  listContent: { paddingHorizontal: 16, flexGrow: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16 },

  card: { borderRadius: 12, marginBottom: 12, flexDirection: 'row', overflow: 'hidden' },
  cardDark: { backgroundColor: '#1C1C1E' },
  cardLight: { backgroundColor: '#FFFFFF' },
  
  thumbnail: { width: 80, height: 110, backgroundColor: '#333' },
  thumbnailPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  thumbnailPlaceholderText: { color: '#888', fontSize: 12 },
  
  cardContent: { flex: 1, padding: 12, justifyContent: 'center' },
  domainText: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  urlText: { fontSize: 12, marginBottom: 8, opacity: 0.8 },
  timeText: { fontSize: 14, fontWeight: '500' },
  
  textDark: { color: '#FFFFFF' },
  textLight: { color: '#000000' },
  textSecondaryDark: { color: '#EBEBF5' },
  textSecondaryLight: { color: '#3C3C43' },
});
