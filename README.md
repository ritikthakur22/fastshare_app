# 📱 FastShare Android App

<div align="center">
  <img src="https://raw.githubusercontent.com/ritikthakur22/FastShare/master/frontend/images/android-chrome-192x192.png" width="128" alt="FastShare Logo" />
  
  **The official native Android App for FastShare**

  [![Download APK](https://img.shields.io/badge/Download-APK-success.svg?style=for-the-badge&logo=android)](https://github.com/ritikthakur22/fastshare_app/releases/latest)
</div>

---

This is the native Android application wrapper for **FastShare**, a seamless, ultra-fast method to share files and clipboard across devices. 

While FastShare runs beautifully in any web browser, this Android app wraps the FastShare web application into a fully native experience using **Capacitor**.

## ✨ App Exclusive Features
- **Native File Downloads**: Bypasses browser restrictions to securely save files natively into your device's `Downloads` or `Pictures` folders utilizing the Android MediaStore API.
- **Chunked File Transfer**: Advanced chunked native transfer system that efficiently saves massive files without crashing the WebView.
- **Material Theme Engine**: Dynamically customize the entire app's material UI color theme right from the sidebar using handcrafted presets. Fully synchronizes with the Android native status bar.
- **Native Notifications**: Fully integrated with Android's notification system.
- **Standalone Experience**: Install FastShare as an app directly on your phone without relying on browser UI.

## 🔗 Links

- **Main Web App**: [https://fastshare.ritikthakur.com.np](https://fastshare.ritikthakur.com.np)
- **FastShare Core Source Code**: [ritikthakur22/FastShare](https://github.com/ritikthakur22/FastShare)
- **My Portfolio**: [ritikthakur.com.np](https://ritikthakur.com.np)

## 🛠️ Build it yourself

To build the app yourself, you need Android Studio and Node.js.

```bash
git clone https://github.com/ritikthakur22/fastshare_app.git
cd fastshare_app

npm install
npx cap sync android

# Build the app using Android Studio
```
