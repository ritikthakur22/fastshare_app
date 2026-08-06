#!/bin/bash
set -e

echo "Updating minSdkVersion..."
sed -i 's/minSdkVersion = 24/minSdkVersion = 29/' /home/crdy/testing/app/fastshare/android/variables.gradle

echo "Copying logos..."
LOGO="/home/crdy/testing/websites-project/fastshare/frontend/images/android-chrome-512x512.png"
RES_DIR="/home/crdy/testing/app/fastshare/android/app/src/main/res"

for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
    cp "$LOGO" "$RES_DIR/mipmap-$density/ic_launcher.png"
    cp "$LOGO" "$RES_DIR/mipmap-$density/ic_launcher_round.png"
    cp "$LOGO" "$RES_DIR/mipmap-$density/ic_launcher_foreground.png"
done

echo "Generating Keystore..."
cd /home/crdy/testing/app/fastshare/releases
if [ ! -f release.keystore ]; then
    keytool -genkey -v -keystore release.keystore -alias fastshare -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=FastShare, O=FastShare, C=US" -storepass "fastshare123" -keypass "fastshare123"
fi

echo "Rebuilding APKs..."
cd /home/crdy/testing/app/fastshare/android
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
export ANDROID_HOME=/home/crdy/Android/Sdk
./gradlew assembleRelease
./gradlew bundleRelease

echo "Signing APKs..."
cd /home/crdy/testing/app/fastshare
cp android/app/build/outputs/apk/release/app-universal-release-unsigned.apk releases/fastshare-universal.apk
cp android/app/build/outputs/apk/release/app-arm64-v8a-release-unsigned.apk releases/fastshare-arm64-v8a.apk
cp android/app/build/outputs/apk/release/app-armeabi-v7a-release-unsigned.apk releases/fastshare-armeabi-v7a.apk
cp android/app/build/outputs/bundle/release/app-release.aab releases/fastshare-universal.aab

cd releases
BUILD_TOOLS="/home/crdy/Android/Sdk/build-tools/35.0.0"

for file in fastshare-universal.apk fastshare-arm64-v8a.apk fastshare-armeabi-v7a.apk fastshare-universal.aab; do
    if [[ "$file" == *.apk ]]; then
        $BUILD_TOOLS/zipalign -p -f 4 "$file" "${file%.apk}-aligned.apk"
        $BUILD_TOOLS/apksigner sign --ks release.keystore --ks-pass pass:fastshare123 --key-pass pass:fastshare123 "${file%.apk}-aligned.apk"
        mv "${file%.apk}-aligned.apk" "$file"
    else
        jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore release.keystore -storepass fastshare123 "$file" fastshare
    fi
done
echo "Done!"
