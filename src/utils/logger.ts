export const LogCategory = {
  AI: '[AI Service]',
  SCREENSHOT: '[Screenshot]',
  CACHE: '[Cache]',
  WEBVIEW: '[WebView]',
  STORE: '[Store]',
  UI: '[UI]',
} as const;

type LogCategoryType = typeof LogCategory[keyof typeof LogCategory];

class Logger {
  private formatMessage(category: LogCategoryType, message: string) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1); // HH:MM:SS.mmm
    return `${timestamp} ${category} ${message}`;
  }

  info(category: LogCategoryType, message: string, ...args: any[]) {
    console.log(this.formatMessage(category, message), ...args);
  }

  warn(category: LogCategoryType, message: string, ...args: any[]) {
    console.warn(this.formatMessage(category, message), ...args);
  }

  error(category: LogCategoryType, message: string, ...args: any[]) {
    console.error(this.formatMessage(category, message), ...args);
  }

  debug(category: LogCategoryType, message: string, ...args: any[]) {
    if (__DEV__) {
      console.log(this.formatMessage(category, message), ...args);
    }
  }
}

export const logger = new Logger();
