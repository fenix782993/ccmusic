# FENIX MUSIC Android

Native Android WebView shell for FENIX MUSIC. The app opens the live Render deployment and supports JavaScript, local storage, audio and file selection for admin uploads.

## Build

Requires Android SDK 35, Build Tools 35.0.0, JDK 17/21 and Gradle 8.7+.

```bash
gradle wrapper --gradle-version 8.7
./gradlew assembleDebug
./gradlew bundleRelease
```

Outputs:
- `app/build/outputs/apk/debug/app-debug.apk`
- `app/build/outputs/bundle/release/app-release.aab`

Release signing must be configured with your own keystore for Play Store distribution.
