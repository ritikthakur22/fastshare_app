import Foundation
import Capacitor
import UserNotifications

@objc(NativeFileSaverPlugin)
public class NativeFileSaverPlugin: CAPPlugin {
    
    private var pendingFiles: [String: PendingFile] = [:]
    
    class PendingFile {
        var id: String
        var name: String
        var mimeType: String
        var fileURL: URL?
        var fileHandle: FileHandle?
        var totalSize: Int64
        var bytesWritten: Int64
        var lastNotifyTime: Date
        
        init(id: String, name: String, mimeType: String, totalSize: Int64) {
            self.id = id
            self.name = name
            self.mimeType = mimeType
            self.totalSize = totalSize
            self.bytesWritten = 0
            self.lastNotifyTime = Date(timeIntervalSince1970: 0)
        }
    }
    
    @objc func start(_ call: CAPPluginCall) {
        guard let id = call.getString("id"),
              let name = call.getString("name"),
              let mimeType = call.getString("mimeType") else {
            call.reject("Must provide id, name, and mimeType")
            return
        }
        
        let size = call.getInt("size") ?? 0
        let totalSize = Int64(size)
        
        let pendingFile = PendingFile(id: id, name: name, mimeType: mimeType, totalSize: totalSize)
        
        // Use Documents directory (accessible to users if UIFileSharingEnabled is true)
        let documentsDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let fileURL = documentsDirectory.appendingPathComponent(name)
        
        // Remove file if it already exists
        if FileManager.default.fileExists(atPath: fileURL.path) {
            do {
                try FileManager.default.removeItem(at: fileURL)
            } catch {
                call.reject("Could not remove existing file")
                return
            }
        }
        
        // Create empty file
        FileManager.default.createFile(atPath: fileURL.path, contents: nil, attributes: nil)
        
        do {
            let fileHandle = try FileHandle(forWritingTo: fileURL)
            pendingFile.fileURL = fileURL
            pendingFile.fileHandle = fileHandle
            self.pendingFiles[id] = pendingFile
            call.resolve()
        } catch {
            call.reject("Could not create file handle: \(error)")
        }
    }
    
    @objc func writeChunk(_ call: CAPPluginCall) {
        guard let id = call.getString("id"),
              let dataString = call.getString("data") else {
            call.reject("Must provide id and data")
            return
        }
        
        guard let pendingFile = self.pendingFiles[id] else {
            call.reject("No pending file found for id \(id)")
            return
        }
        
        // Remove data URI prefix if present
        var base64String = dataString
        if let commaIndex = dataString.firstIndex(of: ",") {
            base64String = String(dataString[dataString.index(after: commaIndex)...])
        }
        
        guard let data = Data(base64Encoded: base64String) else {
            call.reject("Invalid base64 data")
            return
        }
        
        do {
            if #available(iOS 13.4, *) {
                try pendingFile.fileHandle?.seekToEnd()
                try pendingFile.fileHandle?.write(contentsOf: data)
            } else {
                pendingFile.fileHandle?.seekToEndOfFile()
                pendingFile.fileHandle?.write(data)
            }
            
            pendingFile.bytesWritten += Int64(data.count)
            
            // Notification logic (optional, keeping it simple for iOS)
            let now = Date()
            if now.timeIntervalSince(pendingFile.lastNotifyTime) >= 1.0 {
                pendingFile.lastNotifyTime = now
                var progress = 0
                if pendingFile.totalSize > 0 {
                    progress = Int((Double(pendingFile.bytesWritten) / Double(pendingFile.totalSize)) * 100)
                }
                
                let content = UNMutableNotificationContent()
                content.title = "Downloading \(pendingFile.name)"
                content.body = "\(progress)% complete"
                content.sound = nil
                
                let request = UNNotificationRequest(identifier: "download_\(id)", content: content, trigger: nil)
                UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
            }
            
            call.resolve()
        } catch {
            call.reject("Error writing data: \(error)")
        }
    }
    
    @objc func close(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("Must provide id")
            return
        }
        
        guard let pendingFile = self.pendingFiles.removeValue(forKey: id) else {
            call.reject("No pending file found for id \(id)")
            return
        }
        
        do {
            if #available(iOS 13.0, *) {
                try pendingFile.fileHandle?.close()
            } else {
                pendingFile.fileHandle?.closeFile()
            }
            
            // Final success notification
            let content = UNMutableNotificationContent()
            content.title = "Download Complete"
            content.body = "Saved \(pendingFile.name) to Files"
            content.sound = UNNotificationSound.default
            
            let request = UNNotificationRequest(identifier: "download_\(id)", content: content, trigger: nil)
            UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
            
            call.resolve()
        } catch {
            call.reject("Error closing file: \(error)")
        }
    }
}
