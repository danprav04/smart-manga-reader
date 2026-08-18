# Smart Manga Reader

Smart Manga Reader is a React Native app built with Expo that allows users to read manga directly from the web while providing AI-powered Japanese translation, grammar explanations, and vocabulary breakdowns. It seamlessly overlays educational insights on top of the manga pages using on-device screenshot captures and AI vision APIs.

## Features

- **Built-in Web Browser**: Browse and read your favorite manga sites within the app.
- **AI-Powered Breakdown**: Captures the current screen and uses AI (Gemini/OpenAI) to analyze the page.
- **Interactive Overlay**: Tappable bounding boxes over Japanese text to view translations.
- **Language Tutoring**: Provides romaji/kana readings, English translations, grammar point explanations, and vocabulary lists tailored to your progression level.
- **Offline Caching**: Saves previous page breakdowns to a local SQLite database for quick re-access without re-calling the AI API.
- **Night Mode**: Custom CSS injection to invert colors for comfortable reading in the dark.

## Tech Stack

- **Framework**: React Native with Expo (SDK 57)
- **Routing**: Expo Router
- **State Management**: React Context / Hooks (`useSettings`, `useBreakdown`)
- **Storage**: Expo SQLite (caching breakdowns), AsyncStorage (settings), Expo Secure Store (API keys)
- **AI Integration**: Gemini Vision API & OpenAI Vision API
- **UI Components**: `@gorhom/bottom-sheet`, `react-native-reanimated`, `expo-glass-effect`
- **Utilities**: `react-native-view-shot` for screen capture, `react-native-webview` for browsing

## Prerequisites

- Node.js
- npm or yarn
- Expo CLI
- API keys for AI services:
  - Gemini API Key (recommended) OR
  - OpenAI API Key

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd smart-manga-reader
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the app:**
   ```bash
   npm start
   ```
   Or to run directly on an emulator:
   ```bash
   npm run android
   npm run ios
   ```

4. **Development Build:**
   This project uses custom native modules (like `react-native-view-shot`), so you may need a development build instead of standard Expo Go.
   ```bash
   npm run android:dev
   npm run ios:dev
   ```

5. **Configure API Keys:**
   Open the app, navigate to the Settings screen (⚙️), and enter your Gemini or OpenAI API key.

## Project Structure

- `/app`: Expo Router file-based routing screens (`index.tsx` for the main reader, `settings.tsx` for configuration).
- `/src/components`: UI components like the breakdown bottom sheet and text overlays.
- `/src/services`: Core logic including AI API calls (`aiService.ts`), SQLite database (`databaseService.ts`), and screen capturing (`screenshotService.ts`).
- `/src/store`: State management hooks for breakdown data and user settings.
- `/src/config`: App configuration and defaults.

## How it Works

1. The user browses to a manga chapter using the embedded `WebView`.
2. Tapping the Floating Action Button triggers `react-native-view-shot` to capture the current visible screen.
3. The image is sent to the AI vision model (Gemini or OpenAI) along with a specialized system prompt.
4. The AI returns a structured JSON payload containing bounding boxes, translations, vocabulary, and grammar notes.
5. The data is cached in the local SQLite database.
6. An `OverlayLayer` renders clickable boxes over the manga, and a bottom sheet displays the detailed linguistic breakdown.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
