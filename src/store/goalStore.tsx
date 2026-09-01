import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { DailyProgress, StreakData } from '../types/breakdown';
import { useSettings } from './settingsStore';
import { getTodayProgress, getStreakData, reconcileStreak, recordPageCompleted, updateStreakForGoalMet } from '../services/databaseService';

interface GoalState {
  todayProgress: DailyProgress;
  streakData: StreakData;
  isLoaded: boolean;
  goalJustCompleted: boolean;  // flag to trigger celebration banner
  milestoneReached: number | null;  // streak milestone number (7, 14, 30, 60, 100, 365)
}

interface GoalContextType {
  state: GoalState;
  refreshProgress: () => Promise<void>;
  markPageCompleted: () => Promise<void>;
  dailyGoalMet: boolean;  // computed: todayProgress.pagesCompleted >= settings.goalSettings.dailyPageGoal
  dismissCelebration: () => void;
}

const defaultTodayProgress: DailyProgress = {
  date: '',
  pagesScanned: 0,
  pagesCompleted: 0,
  newWords: 0,
  newGrammar: 0,
};

const defaultStreakData: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  freezeAvailable: true,
  freezeLastRecharged: null,
};

const defaultState: GoalState = {
  todayProgress: defaultTodayProgress,
  streakData: defaultStreakData,
  isLoaded: false,
  goalJustCompleted: false,
  milestoneReached: null,
};

const GoalContext = createContext<GoalContextType | undefined>(undefined);

const MILESTONES = [7, 14, 30, 60, 100, 365];

export const GoalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { settings, isLoading: settingsLoading } = useSettings();
  const dailyPageGoal = settings.goalSettings.dailyPageGoal;
  const streakFreezeEnabled = settings.goalSettings.streakFreezeEnabled;

  const [state, setState] = useState<GoalState>(defaultState);

  const loadInitialData = useCallback(async () => {
    try {
      await reconcileStreak(dailyPageGoal, streakFreezeEnabled);
      const today = await getTodayProgress();
      const streak = await getStreakData();
      
      setState(prev => ({
        ...prev,
        todayProgress: today || defaultTodayProgress,
        streakData: streak || defaultStreakData,
        isLoaded: true,
      }));
    } catch (error) {
      console.error('Failed to load goal data:', error);
    }
  }, [dailyPageGoal, streakFreezeEnabled]);

  useEffect(() => {
    if (!settingsLoading) {
      loadInitialData();
    }
  }, [settingsLoading, loadInitialData]);

  const refreshProgress = useCallback(async () => {
    try {
      const today = await getTodayProgress();
      const streak = await getStreakData();
      setState(prev => ({
        ...prev,
        todayProgress: today || defaultTodayProgress,
        streakData: streak || defaultStreakData,
      }));
    } catch (error) {
      console.error('Failed to refresh progress:', error);
    }
  }, []);

  const markPageCompleted = useCallback(async () => {
    try {
      const currentPages = state.todayProgress.pagesCompleted;
      
      await recordPageCompleted();
      const newToday = await getTodayProgress();
      
      let goalJustCompleted = false;
      let milestoneReached: number | null = null;
      let newStreakData = state.streakData;

      if (currentPages < dailyPageGoal && (newToday?.pagesCompleted || 0) >= dailyPageGoal) {
        goalJustCompleted = true;
        await updateStreakForGoalMet();
        newStreakData = await getStreakData() || defaultStreakData;
        
        if (MILESTONES.includes(newStreakData.currentStreak)) {
          milestoneReached = newStreakData.currentStreak;
        }
      }

      setState(prev => ({
        ...prev,
        todayProgress: newToday || prev.todayProgress,
        streakData: newStreakData,
        goalJustCompleted: prev.goalJustCompleted || goalJustCompleted,
        milestoneReached: milestoneReached || prev.milestoneReached,
      }));
    } catch (error) {
      console.error('Failed to mark page completed:', error);
    }
  }, [state.todayProgress.pagesCompleted, state.streakData, dailyPageGoal]);

  const dismissCelebration = useCallback(() => {
    setState(prev => ({
      ...prev,
      goalJustCompleted: false,
      milestoneReached: null,
    }));
  }, []);

  const dailyGoalMet = state.todayProgress.pagesCompleted >= dailyPageGoal;

  const value: GoalContextType = {
    state,
    refreshProgress,
    markPageCompleted,
    dailyGoalMet,
    dismissCelebration,
  };

  return <GoalContext.Provider value={value}>{children}</GoalContext.Provider>;
};

export const useDailyGoal = (): GoalContextType => {
  const context = useContext(GoalContext);
  if (!context) {
    throw new Error('useDailyGoal must be used within a GoalProvider');
  }
  return context;
};
