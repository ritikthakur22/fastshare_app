import { Toast } from '@capacitor/toast';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const NativeFileSaver = registerPlugin('NativeFileSaver');

window.saveFileToCapacitor = async function saveFileToCapacitor(file, fileName) {
    if (!Capacitor.isNativePlatform()) return false;

    if (Capacitor.getPlatform() === 'ios') {
        try {
            const chunkSize = 256 * 1024;
            // Write first chunk to create the file
            let isFirst = true;
            for (let offset = 0; offset < file.size; offset += chunkSize) {
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onerror = () => reject(new Error('Could not read the received file'));
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(file.slice(offset, offset + chunkSize));
                });
                
                const data = dataUrl.split(',', 2)[1];
                if (isFirst) {
                    await Filesystem.writeFile({
                        path: fileName,
                        data: data,
                        directory: Directory.Documents,
                    });
                    isFirst = false;
                } else {
                    await Filesystem.appendFile({
                        path: fileName,
                        data: data,
                        directory: Directory.Documents,
                    });
                }
            }
            
            await Toast.show({ text: `Saved ${fileName}`, duration: 'long' });
            return true;
        } catch (error) {
            console.error('iOS write failed', error);
            await Toast.show({ text: `Failed to save ${fileName}: ${error?.message || error}`, duration: 'long' });
            return false;
        }
    }

    try {
        const saveToGallery = localStorage.getItem('setting-gallery') === 'true';
        const started = await NativeFileSaver.start({
            name: fileName,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            saveToGallery,
        });
        try {
            const chunkSize = 256 * 1024;
            for (let offset = 0; offset < file.size; offset += chunkSize) {
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onerror = () => reject(new Error('Could not read the received file'));
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(file.slice(offset, offset + chunkSize));
                });
                await NativeFileSaver.writeChunk({
                    token: started.token,
                    data: dataUrl.split(',', 2)[1],
                });
            }
            const result = await NativeFileSaver.finish({ token: started.token });
            await Toast.show({ text: `Saved ${started.displayName}`, duration: 'long' });
            return result;
        } catch (error) {
            await NativeFileSaver.cancel({ token: started.token }).catch(() => {});
            throw error;
        }
    } catch (error) {
        console.error('Shared-storage write failed', error);
        await Toast.show({ text: `Failed to save ${fileName}: ${error?.message || error}`, duration: 'long' });
        return false;
    }
};

window.setNativeSystemBars = async function setNativeSystemBars(color) {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() === 'ios') return;
    try {
        await NativeFileSaver.setSystemBars({ color });
    } catch (error) {
        // The theme is still valid in a browser or an older native shell.
        console.debug('Could not update Android system bars', error);
    }
};

window.requestAppPermissions = async function requestAppPermissions() {
    if (!Capacitor.isNativePlatform()) return;
    try {
        await LocalNotifications.requestPermissions();
    } catch (error) {
        console.error('Notification permission request failed', error);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => window.requestAppPermissions?.(), 1500);
});
