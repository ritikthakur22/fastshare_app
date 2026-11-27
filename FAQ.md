# Frequently Asked Questions & Guides

---

## 1. How do I install FastShare on iPhone / iPad (Unsigned IPA)?

Because the iOS build is distributed as an unsigned `.ipa` (`FastShare-v2.0.2-unsigned.ipa`), you can sideload it onto your iPhone or iPad using any standard signing tool:

1. Download **`FastShare-v2.0.2-unsigned.ipa`** from the [Releases](https://github.com/ritikthakur22/fastshare_app/releases) page.
2. Open **AltStore**, **Sideloadly**, or **TrollStore** on your computer or device.
3. Select the downloaded `.ipa` and sign it with your Apple ID (or install directly with TrollStore).
4. On iOS, go to **Settings -> General -> VPN & Device Management** and trust your developer profile if prompted.
5. When opening FastShare for the first time, allow **Local Network** access so nearby devices can appear on the radar.

> **Note:** On iOS, keep FastShare open in the foreground while receiving files (an iOS background networking restriction).

---

## 2. Why does my laptop browser show "Internet" on the same Wi-Fi?

Web browsers (Chrome, Edge, Safari, Firefox) run inside a security sandbox and cannot open raw TCP server sockets (port `53317`) or listen for UDP multicast (`mDNS`). Because of browser sandbox limits, the [FastShare Web Client](https://fastshare.ritikthakur.com.np) always connects via **WebRTC** and appears with the **Internet** badge even when your laptop and phone share the same router.

---

## 3. Does FastShare work with LocalSend?

**Yes.** FastShare supports the **LocalSend v2.2** protocol out of the box on port `53317`. Any LocalSend app on Windows, macOS, Linux, Android, or iOS on the same Wi-Fi network will appear on your radar labeled `Wi-Fi, LocalSend`.

---

## 4. How do I share without any Wi-Fi router?

Use the built-in **Offline Hotspot** feature on Android:
1. Tap **No Wi-Fi? Create hotspot** on the Nearby screen (or via **Link -> Hotspot**).
2. FastShare starts a local-only Wi-Fi hotspot and shows a QR code.
3. On the second phone, open FastShare's **Scan** button (top right) and scan the Wi-Fi QR code. FastShare connects to the hotspot automatically without typing a password.

*(Android's local-only hotspot API assigns a system-generated SSID and passphrase for security; scanning the QR code handles connection automatically.)*

---

## 5. What if a device appears over both Wi-Fi and the Internet?

FastShare automatically merges dual-reachable devices into a single radar node labeled **`Wi-Fi + Internet`**. When you tap that device to send, you can choose **`Wi-Fi (Fast direct)`** or **`Internet`** at the top of the Send sheet.
