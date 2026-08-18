import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Settings } from '../types/breakdown';

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  isLoading: boolean;
}

const defaultSettings: Settings = {
  aiProvider: 'gemini',
  geminiModel: 'gemini-3.7-flash',
  geminiFallbackSequence: 'gemini-3.7-flash, gemini-3.6-flash, gemini-3.5-flash',
  openaiBaseUrl: '',
  openaiModel: '',
  readerBaseUrl: 'https://www.cmoa.jp',
  japaneseLevel: '',
  darkMode: true,
  nightReader: false,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await AsyncStorage.getItem('@settings');
        if (storedSettings) {
          setSettings((prev) => ({ ...prev, ...JSON.parse(storedSettings) }));
        }
      } catch (e) {
        console.error('Failed to load settings', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      await AsyncStorage.setItem('@settings', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

// API Keys are managed separately since they use SecureStore
export const getGeminiApiKey = async () => await SecureStore.getItemAsync('geminiApiKey');
export const setGeminiApiKey = async (key: string) => await SecureStore.setItemAsync('geminiApiKey', key);
export const getOpenAIApiKey = async () => await SecureStore.getItemAsync('openaiApiKey');
export const setOpenAIApiKey = async (key: string) => await SecureStore.setItemAsync('openaiApiKey', key);
