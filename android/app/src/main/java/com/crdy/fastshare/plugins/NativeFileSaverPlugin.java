package com.crdy.fastshare.plugins;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

@CapacitorPlugin(name = "NativeFileSaver")
public class NativeFileSaverPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String base64Data = call.getString("data");
        String name = call.getString("name");
        String mimeType = call.getString("mimeType");
        boolean saveToGallery = call.getBoolean("saveToGallery", false);

        if (base64Data == null || name == null || mimeType == null) {
            call.reject("Must provide data, name, and mimeType");
            return;
        }

        byte[] decodedBytes = Base64.decode(base64Data, Base64.DEFAULT);

        try {
            Uri contentUri;
            ContentValues values = new ContentValues();
            String safeName = System.currentTimeMillis() + "_" + name;
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);

            if (saveToGallery && mimeType.startsWith("image/")) {
                contentUri = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/FastShare");
                }
            } else if (saveToGallery && mimeType.startsWith("video/")) {
                contentUri = MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/FastShare");
                }
            } else {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    contentUri = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/FastShare");
                } else {
                    // For below Android 10, saving to standard external dir
                    contentUri = MediaStore.Files.getContentUri("external");
                }
            }

            Uri uri = getContext().getContentResolver().insert(contentUri, values);
            if (uri != null) {
                try (OutputStream outputStream = getContext().getContentResolver().openOutputStream(uri)) {
                    if (outputStream != null) {
                        outputStream.write(decodedBytes);
                        outputStream.close();
                        
                        JSObject ret = new JSObject();
                        ret.put("path", uri.toString());
                        call.resolve(ret);
                        return;
                    }
                }
            }
            call.reject("Failed to create file: MediaStore returned null");
        } catch (Exception e) {
            call.reject(e.toString());
        }
    }
}
