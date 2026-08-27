package com.crdy.fastshare.plugins;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.OutputStream;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Saves received files directly to shared storage instead of the app sandbox. */
@CapacitorPlugin(name = "NativeFileSaver")
public class NativeFileSaverPlugin extends Plugin {

    private final ConcurrentHashMap<String, PendingFile> pendingFiles = new ConcurrentHashMap<>();

    private static final class PendingFile {
        final Uri uri;
        final OutputStream output;
        final String displayName;
        final int notificationId;
        final long totalSize;
        long bytesWritten = 0;
        long lastNotifyTime = 0;

        PendingFile(Uri uri, OutputStream output, String displayName, int notificationId, long totalSize) {
            this.uri = uri;
            this.output = output;
            this.displayName = displayName;
            this.notificationId = notificationId;
            this.totalSize = totalSize;
        }
    }

    private android.app.NotificationManager getNotificationManager() {
        return (android.app.NotificationManager) getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
    }

    private void createNotificationChannel() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            android.app.NotificationChannel channel = new android.app.NotificationChannel("download_channel", "Downloads", android.app.NotificationManager.IMPORTANCE_LOW);
            getNotificationManager().createNotificationChannel(channel);
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        String name = call.getString("name");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        boolean saveToGallery = call.getBoolean("saveToGallery", false);
        Number sizeNum = call.getNumber("size");
        long totalSize = sizeNum != null ? sizeNum.longValue() : 0;
        
        if (name == null || name.trim().isEmpty()) {
            call.reject("Must provide a file name");
            return;
        }

        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeDisplayName(name));
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, destinationFor(mimeType, saveToGallery));
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri item = null;
        try {
            item = resolver.insert(collectionFor(mimeType, saveToGallery), values);
            if (item == null) throw new IOException("Android could not create the destination file");
            OutputStream output = resolver.openOutputStream(item, "w");
            if (output == null) throw new IOException("Android could not open the destination file");
            String token = UUID.randomUUID().toString();
            String displayName = values.getAsString(MediaStore.MediaColumns.DISPLAY_NAME);
            int notificationId = token.hashCode();
            pendingFiles.put(token, new PendingFile(item, output, displayName, notificationId, totalSize));
            
            createNotificationChannel();
            androidx.core.app.NotificationCompat.Builder builder = new androidx.core.app.NotificationCompat.Builder(getContext(), "download_channel")
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle("Downloading " + displayName)
                .setProgress(100, 0, totalSize <= 0)
                .setOngoing(true);
            getNotificationManager().notify(notificationId, builder.build());
            JSObject result = new JSObject();
            result.put("token", token);
            result.put("displayName", values.getAsString(MediaStore.MediaColumns.DISPLAY_NAME));
            call.resolve(result);
        } catch (Exception error) {
            if (item != null) resolver.delete(item, null, null);
            call.reject("Unable to start shared-storage write", error);
        }
    }

    @PluginMethod
    public void writeChunk(PluginCall call) {
        String token = call.getString("token");
        String base64Data = call.getString("data");
        PendingFile pending = token == null ? null : pendingFiles.get(token);
        if (pending == null || base64Data == null) {
            call.reject("Invalid or expired file write");
            return;
        }
        try {
            byte[] chunk = Base64.decode(base64Data, Base64.DEFAULT);
            pending.output.write(chunk);
            pending.bytesWritten += chunk.length;
            
            if (pending.totalSize > 0) {
                long now = System.currentTimeMillis();
                // Update notification at most once per second to avoid spamming the system
                if (now - pending.lastNotifyTime > 1000) {
                    pending.lastNotifyTime = now;
                    int progress = (int) ((pending.bytesWritten * 100) / pending.totalSize);
                    androidx.core.app.NotificationCompat.Builder builder = new androidx.core.app.NotificationCompat.Builder(getContext(), "download_channel")
                        .setSmallIcon(android.R.drawable.stat_sys_download)
                        .setContentTitle("Downloading " + pending.displayName)
                        .setProgress(100, progress, false)
                        .setOngoing(true);
                    getNotificationManager().notify(pending.notificationId, builder.build());
                }
            }
            call.resolve();
        } catch (Exception error) {
            discard(token, pending);
            call.reject("Unable to write file data", error);
        }
    }

    @PluginMethod
    public void finish(PluginCall call) {
        String token = call.getString("token");
        PendingFile pending = token == null ? null : pendingFiles.remove(token);
        if (pending == null) {
            call.reject("Invalid or expired file write");
            return;
        }
        ContentResolver resolver = getContext().getContentResolver();
        try {
            pending.output.flush();
            pending.output.close();
            ContentValues published = new ContentValues();
            published.put(MediaStore.MediaColumns.IS_PENDING, 0);
            if (resolver.update(pending.uri, published, null, null) != 1) {
                throw new IOException("Android could not publish the saved file");
            }
            JSObject result = new JSObject();
            result.put("uri", pending.uri.toString());
            
            androidx.core.app.NotificationCompat.Builder builder = new androidx.core.app.NotificationCompat.Builder(getContext(), "download_channel")
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle(pending.displayName)
                .setContentText("Download complete")
                .setAutoCancel(true);
            
            android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_VIEW);
            intent.setDataAndType(pending.uri, resolver.getType(pending.uri));
            intent.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
            android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
                    getContext(), pending.notificationId, intent, android.app.PendingIntent.FLAG_IMMUTABLE | android.app.PendingIntent.FLAG_UPDATE_CURRENT);
            builder.setContentIntent(pendingIntent);
            
            getNotificationManager().notify(pending.notificationId, builder.build());
            call.resolve(result);
        } catch (Exception error) {
            resolver.delete(pending.uri, null, null);
            call.reject("Unable to finish shared-storage write", error);
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String token = call.getString("token");
        PendingFile pending = token == null ? null : pendingFiles.remove(token);
        if (pending != null) discard(token, pending);
        call.resolve();
    }

    @PluginMethod
    public void save(PluginCall call) {
        String base64Data = call.getString("data");
        String name = call.getString("name");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        boolean saveToGallery = call.getBoolean("saveToGallery", false);

        if (base64Data == null || name == null || name.trim().isEmpty()) {
            call.reject("Must provide data and a file name");
            return;
        }

        final byte[] bytes;
        try {
            bytes = Base64.decode(base64Data, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            call.reject("The file data is not valid Base64", error);
            return;
        }

        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeDisplayName(name));
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, destinationFor(mimeType, saveToGallery));
        // Keep a partially-written item out of Downloads/Gallery until it is complete.
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri collection = collectionFor(mimeType, saveToGallery);
        Uri item = null;
        try {
            item = resolver.insert(collection, values);
            if (item == null) {
                call.reject("Android could not create the destination file");
                return;
            }

            try (OutputStream output = resolver.openOutputStream(item, "w")) {
                if (output == null) {
                    throw new IOException("Android could not open the destination file");
                }
                output.write(bytes);
                output.flush();
            }

            ContentValues published = new ContentValues();
            published.put(MediaStore.MediaColumns.IS_PENDING, 0);
            if (resolver.update(item, published, null, null) != 1) {
                throw new IOException("Android could not publish the saved file");
            }

            JSObject result = new JSObject();
            result.put("uri", item.toString());
            result.put("displayName", values.getAsString(MediaStore.MediaColumns.DISPLAY_NAME));
            call.resolve(result);
        } catch (Exception error) {
            // Do not leave an invisible, incomplete MediaStore row behind on failure.
            if (item != null) {
                resolver.delete(item, null, null);
            }
            call.reject("Unable to save file to shared storage", error);
        }
    }

    @PluginMethod
    public void setSystemBars(PluginCall call) {
        String colorValue = call.getString("color");
        if (colorValue == null || !colorValue.matches("^#[0-9a-fA-F]{6}$")) {
            call.reject("color must be a six-digit hex value");
            return;
        }

        int color = Color.parseColor(colorValue);
        boolean useDarkIcons = Color.luminance(color) > 0.5;
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            window.setStatusBarColor(color);
            window.setNavigationBarColor(color);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                int flags = window.getDecorView().getSystemUiVisibility();
                flags = useDarkIcons ? flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                        : flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    flags = useDarkIcons ? flags | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                            : flags & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
                window.getDecorView().setSystemUiVisibility(flags);
            }
            call.resolve();
        });
    }

    private Uri collectionFor(String mimeType, boolean saveToGallery) {
        if (saveToGallery && mimeType.startsWith("image/")) {
            return MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
        }
        if (saveToGallery && mimeType.startsWith("video/")) {
            return MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
        }
        return MediaStore.Downloads.EXTERNAL_CONTENT_URI;
    }

    private void discard(String token, PendingFile pending) {
        pendingFiles.remove(token, pending);
        getNotificationManager().cancel(pending.notificationId);
        try {
            pending.output.close();
        } catch (IOException ignored) {
        }
        getContext().getContentResolver().delete(pending.uri, null, null);
    }

    private String destinationFor(String mimeType, boolean saveToGallery) {
        if (saveToGallery && mimeType.startsWith("image/")) {
            return Environment.DIRECTORY_PICTURES;
        }
        if (saveToGallery && mimeType.startsWith("video/")) {
            return Environment.DIRECTORY_MOVIES;
        }
        return Environment.DIRECTORY_DOWNLOADS;
    }

    private String safeDisplayName(String name) {
        String cleaned = name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        return cleaned.isEmpty() ? "FastShare-file" : cleaned;
    }
}
