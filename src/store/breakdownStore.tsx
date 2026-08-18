import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { BreakdownResult, StoredBreakdown } from '../types/breakdown';

interface BreakdownState {
  currentBreakdown: BreakdownResult | StoredBreakdown | null;
  isAnalyzing: boolean;
  overlayVisible: boolean;
  screenshotUri: string | null;
  currentUrl: string | null;
  hasCachedBreakdown: boolean;
}

type Action =
  | { type: 'START_ANALYSIS' }
  | { type: 'ANALYSIS_COMPLETE'; payload: { result: BreakdownResult; screenshotUri: string | null } }
  | { type: 'ANALYSIS_ERROR'; payload: string }
  | { type: 'LOAD_CACHED'; payload: StoredBreakdown }
  | { type: 'DISMISS_OVERLAY' }
  | { type: 'SET_URL'; payload: { url: string; hasCache: boolean } };

const initialState: BreakdownState = {
  currentBreakdown: null,
  isAnalyzing: false,
  overlayVisible: false,
  screenshotUri: null,
  currentUrl: null,
  hasCachedBreakdown: false,
};

const breakdownReducer = (state: BreakdownState, action: Action): BreakdownState => {
  switch (action.type) {
    case 'START_ANALYSIS':
      return { ...state, isAnalyzing: true };
    case 'ANALYSIS_COMPLETE':
      return {
        ...state,
        isAnalyzing: false,
        currentBreakdown: action.payload.result,
        screenshotUri: action.payload.screenshotUri,
        overlayVisible: true,
        hasCachedBreakdown: true,
      };
    case 'ANALYSIS_ERROR':
      return { ...state, isAnalyzing: false };
    case 'LOAD_CACHED':
      return {
        ...state,
        currentBreakdown: action.payload,
        screenshotUri: action.payload.screenshotPath || null,
        overlayVisible: true,
      };
    case 'DISMISS_OVERLAY':
      return { ...state, overlayVisible: false };
    case 'SET_URL':
      const urlChanged = state.currentUrl !== action.payload.url;
      return {
        ...state,
        currentUrl: action.payload.url,
        hasCachedBreakdown: action.payload.hasCache,
        overlayVisible: urlChanged ? false : state.overlayVisible,
      };
    default:
      return state;
  }
};

const BreakdownContext = createContext<{
  state: BreakdownState;
  dispatch: React.Dispatch<Action>;
} | undefined>(undefined);

export const BreakdownProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(breakdownReducer, initialState);

  return (
    <BreakdownContext.Provider value={{ state, dispatch }}>
      {children}
    </BreakdownContext.Provider>
  );
};

export const useBreakdown = () => {
  const context = useContext(BreakdownContext);
  if (context === undefined) {
    throw new Error('useBreakdown must be used within a BreakdownProvider');
  }
  return context;
};
