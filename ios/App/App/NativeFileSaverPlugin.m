import <Capacitor/Capacitor.h>

CAP_PLUGIN(NativeFileSaverPlugin, "NativeFileSaver",
    CAP_PLUGIN_METHOD(start, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(writeChunk, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(close, CAPPluginReturnPromise);
)
