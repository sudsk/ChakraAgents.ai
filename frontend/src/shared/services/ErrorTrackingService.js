import * as Sentry from "@sentry/react";

class ErrorTrackingService {
  static init(options = {}) {
    Sentry.init({
      dsn: process.env.REACT_APP_SENTRY_DSN,
      integrations: [new Sentry.BrowserTracing()],
      tracesSampleRate: 1.0,
      ...options
    });
  }

  static log(error, context = {}) {
    Sentry.withScope((scope) => {
      // Add context to error
      Object.keys(context).forEach(key => {
        scope.setExtra(key, context[key]);
      });

      // Capture error
      Sentry.captureException(error);
    });

    // Optional: console logging
    console.error('Tracked Error:', error, context);
  }

  static createErrorBoundary() {
    return Sentry.ErrorBoundary;
  }
}

export default ErrorTrackingService;
