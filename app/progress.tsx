import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../src/store/settingsStore';
import { useDailyGoal } from '../src/store/goalStore';
import { getDailyProgressRange } from '../src/services/databaseService';
import { DailyProgress } from '../src/types/breakdown';

// Helper functions for dates
const formatDate = (date: Date): string => {
  const d = new Date(date);
  const month = '' + (d.getMonth() + 1);
  const day = '' + d.getDate();
  const year = d.getFullYear();
  return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
};

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getStartOfMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const getEndOfMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

export default function ProgressScreen() {
  const { settings } = useSettings();
  const goalContext = useDailyGoal();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const isDark = settings.darkMode;
  const theme = isDark ? darkTheme : lightTheme;

  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState<Record<string, DailyProgress>>({});
  
  // Calendar state
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const dailyPageGoal = settings.goalSettings.dailyPageGoal;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const today = new Date();
      
      // Load 12 weeks for heatmap, plus extra for previous month/week stats
      const endDate = new Date(today);
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 120); // About 4 months back to be safe

      const startStr = formatDate(startDate);
      const endStr = formatDate(endDate);

      const data = await getDailyProgressRange(startStr, endStr);
      
      const progressMap: Record<string, DailyProgress> = {};
      data.forEach(item => {
        progressMap[item.date] = item;
      });
      
      setProgressData(progressMap);
    } catch (error) {
      console.error('Error loading progress data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived stats
  const todayStr = formatDate(new Date());
  const todayProgress = progressData[todayStr] || { pagesCompleted: 0, newWords: 0, newGrammar: 0, date: todayStr };
  
  const currentStreak = goalContext.state.streakData.currentStreak;
  const longestStreak = goalContext.state.streakData.longestStreak;
  const freezeAvailable = goalContext.state.streakData.freezeAvailable;

  // Summary calculations
  const calculatePeriodStats = (start: Date, end: Date) => {
    let pages = 0, words = 0, grammar = 0;
    let curr = new Date(start);
    while (curr <= end) {
      const p = progressData[formatDate(curr)];
      if (p) {
        pages += p.pagesCompleted || 0;
        words += p.newWords || 0;
        grammar += p.newGrammar || 0;
      }
      curr = addDays(curr, 1);
    }
    return { pages, words, grammar };
  };

  const today = new Date();
  
  // Week stats
  const thisWeekStart = getStartOfWeek(today);
  const thisWeekEnd = today;
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = addDays(thisWeekStart, -1);
  
  const thisWeekStats = calculatePeriodStats(thisWeekStart, thisWeekEnd);
  const lastWeekStats = calculatePeriodStats(lastWeekStart, lastWeekEnd);

  // Month stats
  const thisMonthStart = getStartOfMonth(today);
  const thisMonthEnd = today;
  const lastMonthStart = getStartOfMonth(addMonths(today, -1));
  const lastMonthEnd = getEndOfMonth(lastMonthStart);

  const thisMonthStats = calculatePeriodStats(thisMonthStart, thisMonthEnd);
  const lastMonthStats = calculatePeriodStats(lastMonthStart, lastMonthEnd);

  const renderTrend = (current: number, previous: number) => {
    const isUp = current >= previous;
    return (
      <View style={styles.trendContainer}>
        <Text style={[styles.trendArrow, isUp ? styles.trendUp : styles.trendDown]}>
          {isUp ? '▲' : '▼'}
        </Text>
        <Text style={[styles.trendValue, { color: theme.secondary }]}>{previous}</Text>
      </View>
    );
  };

  const renderCalendar = () => {
    const monthStart = getStartOfMonth(currentMonthDate);
    const monthEnd = getEndOfMonth(currentMonthDate);
    const startDayOfWeek = monthStart.getDay(); // 0 = Sunday
    
    const daysInMonth = monthEnd.getDate();
    const weeks = [];
    let currentWeek = [];
    
    // Empty cells before start of month
    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), i);
      const dateStr = formatDate(date);
      const prog = progressData[dateStr];
      const isToday = dateStr === todayStr;
      
      let dayStyle: any[] = [styles.calendarDayInner];
      let hasGoalMet = false;
      let hasSomeActivity = false;
      
      if (prog) {
        if (prog.pagesCompleted >= dailyPageGoal) {
          hasGoalMet = true;
          dayStyle.push(styles.calendarDayMet);
        } else if (prog.pagesCompleted > 0) {
          hasSomeActivity = true;
          dayStyle.push(styles.calendarDayPartial);
        }
      }
      
      if (isToday) {
        dayStyle.push(styles.calendarDayToday);
      }
      
      currentWeek.push(
        <View key={`day-${i}`} style={styles.calendarDay}>
          <View style={dayStyle}>
            <Text style={[styles.calendarDayText, { color: (hasGoalMet || hasSomeActivity) ? '#FFF' : theme.text }]}>
              {i}
            </Text>
          </View>
        </View>
      );
      
      if (currentWeek.length === 7) {
        weeks.push(<View key={`week-${weeks.length}`} style={styles.calendarRow}>{currentWeek}</View>);
        currentWeek = [];
      }
    }
    
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(<View key={`empty-end-${currentWeek.length}`} style={styles.calendarDay} />);
      }
      weeks.push(<View key={`week-${weeks.length}`} style={styles.calendarRow}>{currentWeek}</View>);
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    return (
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={() => setCurrentMonthDate(addMonths(currentMonthDate, -1))}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.calendarTitle, { color: theme.text }]}>
            {monthNames[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
          </Text>
          <TouchableOpacity onPress={() => setCurrentMonthDate(addMonths(currentMonthDate, 1))}>
            <Ionicons name="chevron-forward" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.calendarRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
            <View key={`header-${idx}`} style={styles.calendarDay}>
              <Text style={[styles.calendarHeaderText, { color: theme.secondary }]}>{day}</Text>
            </View>
          ))}
        </View>
        
        {weeks}
      </View>
    );
  };

  const renderHeatmap = () => {
    const weeks = 12;
    const cols = [];
    
    const todayDate = new Date();
    // Start heatmap from Sunday, 12 weeks ago
    const heatmapStart = getStartOfWeek(addDays(todayDate, -(weeks * 7) + 7));
    
    for (let w = 0; w < weeks; w++) {
      const colDays = [];
      for (let d = 0; d < 7; d++) {
        const currentDate = addDays(heatmapStart, w * 7 + d);
        if (currentDate > todayDate) {
          // Future day, render empty block
          colDays.push(<View key={`hm-${w}-${d}`} style={[styles.heatmapCell, { backgroundColor: 'transparent' }]} />);
          continue;
        }
        
        const dateStr = formatDate(currentDate);
        const prog = progressData[dateStr];
        const pages = prog?.pagesCompleted || 0;
        
        let color = '#161616';
        if (pages >= 5) color = '#26a641';
        else if (pages >= 3) color = '#006d32';
        else if (pages >= 1) color = '#0e4429';
        
        // Light mode colors adjustment if needed
        if (!isDark) {
          if (pages === 0) color = '#ebedf0';
          else if (pages >= 5) color = '#216e39';
          else if (pages >= 3) color = '#30a14e';
          else if (pages >= 1) color = '#40c463';
        }

        colDays.push(
          <View key={`hm-${w}-${d}`} style={[styles.heatmapCell, { backgroundColor: color }]} />
        );
      }
      cols.push(<View key={`hm-col-${w}`} style={styles.heatmapCol}>{colDays}</View>);
    }

    return (
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Activity</Text>
        <View style={styles.heatmapWrapper}>
          <View style={styles.heatmapLabels}>
            <Text style={[styles.heatmapLabelText, { color: theme.secondary }]}> </Text>
            <Text style={[styles.heatmapLabelText, { color: theme.secondary }]}>M</Text>
            <Text style={[styles.heatmapLabelText, { color: theme.secondary }]}> </Text>
            <Text style={[styles.heatmapLabelText, { color: theme.secondary }]}>W</Text>
            <Text style={[styles.heatmapLabelText, { color: theme.secondary }]}> </Text>
            <Text style={[styles.heatmapLabelText, { color: theme.secondary }]}>F</Text>
            <Text style={[styles.heatmapLabelText, { color: theme.secondary }]}> </Text>
          </View>
          <View style={styles.heatmapGrid}>
            {cols}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Progress</Text>
        <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Streak Hero Card */}
          <View style={[styles.card, styles.streakCard, { backgroundColor: theme.card }]}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={[styles.streakNumber, { color: theme.text }]}>{currentStreak}</Text>
            <Text style={[styles.streakLabel, { color: theme.secondary }]}>day streak</Text>
            <Text style={[styles.longestStreak, { color: theme.secondary }]}>Longest: {longestStreak} days</Text>
            
            <View style={styles.freezeContainer}>
              <Ionicons name="shield" size={16} color={freezeAvailable ? '#4CAF50' : '#8E8E93'} />
              <Text style={[styles.freezeText, { color: freezeAvailable ? '#4CAF50' : '#8E8E93' }]}>
                {freezeAvailable ? 'Freeze available' : 'Freeze used'}
              </Text>
            </View>
          </View>

          {/* Today's Progress Card */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Today</Text>
            
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, { color: theme.text }]}>Pages</Text>
              <Text style={[styles.progressValues, { color: theme.text }]}>
                {todayProgress.pagesCompleted} <Text style={{ color: theme.secondary }}>/ {dailyPageGoal}</Text>
              </Text>
            </View>
            
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${Math.min(100, (todayProgress.pagesCompleted / dailyPageGoal) * 100)}%` }
                ]} 
              />
            </View>
            
            <Text style={[styles.todayDetails, { color: theme.secondary }]}>
              {todayProgress.newWords || 0} new words · {todayProgress.newGrammar || 0} new grammar
            </Text>
          </View>

          {/* Streak Calendar */}
          {renderCalendar()}

          {/* Activity Heatmap */}
          {renderHeatmap()}

          {/* Weekly Summary Card */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>This Week vs Last Week</Text>
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.text }]}>Pages</Text>
              <View style={styles.summaryValues}>
                <Text style={[styles.summaryCurrent, { color: theme.text }]}>{thisWeekStats.pages}</Text>
                {renderTrend(thisWeekStats.pages, lastWeekStats.pages)}
              </View>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.text }]}>Words</Text>
              <View style={styles.summaryValues}>
                <Text style={[styles.summaryCurrent, { color: theme.text }]}>{thisWeekStats.words}</Text>
                {renderTrend(thisWeekStats.words, lastWeekStats.words)}
              </View>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.text }]}>Grammar</Text>
              <View style={styles.summaryValues}>
                <Text style={[styles.summaryCurrent, { color: theme.text }]}>{thisWeekStats.grammar}</Text>
                {renderTrend(thisWeekStats.grammar, lastWeekStats.grammar)}
              </View>
            </View>
          </View>

          {/* Monthly Summary Card */}
          <View style={[styles.card, { backgroundColor: theme.card, marginBottom: 40 }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>This Month vs Last Month</Text>
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.text }]}>Pages</Text>
              <View style={styles.summaryValues}>
                <Text style={[styles.summaryCurrent, { color: theme.text }]}>{thisMonthStats.pages}</Text>
                {renderTrend(thisMonthStats.pages, lastMonthStats.pages)}
              </View>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.text }]}>Words</Text>
              <View style={styles.summaryValues}>
                <Text style={[styles.summaryCurrent, { color: theme.text }]}>{thisMonthStats.words}</Text>
                {renderTrend(thisMonthStats.words, lastMonthStats.words)}
              </View>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.text }]}>Grammar</Text>
              <View style={styles.summaryValues}>
                <Text style={[styles.summaryCurrent, { color: theme.text }]}>{thisMonthStats.grammar}</Text>
                {renderTrend(thisMonthStats.grammar, lastMonthStats.grammar)}
              </View>
            </View>
          </View>

        </ScrollView>
      )}
    </View>
  );
}

const darkTheme = {
  background: '#000000',
  card: '#1C1C1E',
  text: '#FFFFFF',
  secondary: '#EBEBF5',
};

const lightTheme = {
  background: '#F2F2F7',
  card: '#FFFFFF',
  text: '#000000',
  secondary: '#3C3C43',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  doneButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  doneButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 8,
  },
  streakCard: {
    alignItems: 'center',
  },
  streakEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  streakNumber: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  streakLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: -4,
    marginBottom: 12,
  },
  longestStreak: {
    fontSize: 14,
    marginBottom: 16,
  },
  freezeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  freezeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressValues: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#2C2C2E',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  todayDetails: {
    fontSize: 14,
    textAlign: 'center',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calendarDay: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarHeaderText: {
    fontSize: 14,
    fontWeight: '500',
  },
  calendarDayInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDayMet: {
    backgroundColor: '#4CAF50',
  },
  calendarDayPartial: {
    borderWidth: 2,
    borderColor: '#208AEF',
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  heatmapWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heatmapLabels: {
    marginRight: 8,
    justifyContent: 'space-between',
    height: 116,
  },
  heatmapLabelText: {
    fontSize: 12,
    lineHeight: 14,
  },
  heatmapGrid: {
    flexDirection: 'row',
    gap: 3,
  },
  heatmapCol: {
    gap: 3,
  },
  heatmapCell: {
    width: 14,
    height: 14,
    borderRadius: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  summaryValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryCurrent: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 50,
    justifyContent: 'flex-end',
  },
  trendArrow: {
    fontSize: 12,
  },
  trendUp: {
    color: '#4CAF50',
  },
  trendDown: {
    color: '#FF3B30',
  },
  trendValue: {
    fontSize: 14,
  },
});
