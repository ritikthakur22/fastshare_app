package com.crdy.fastshare;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.crdy.fastshare.plugins.NativeFileSaverPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeFileSaverPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
