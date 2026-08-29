import Foundation
import Capacitor
import UserNotifications
import Photos
import UIKit

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
        
        let documentsDirectory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let fileURL = documentsDirectory.appendingPathComponent(name)
        
        if FileManager.default.fileExists(atPath: fileURL.path) {
            do {
                try FileManager.default.removeItem(at: fileURL)
            } catch {
                call.reject("Could not remove existing file")
                return
            }
        }
        
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
            
            if pendingFile.mimeType.starts(with: "image/") {
                if let fileURL = pendingFile.fileURL, let image = UIImage(contentsOfFile: fileURL.path) {
                    UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
                }
            } else if pendingFile.mimeType.starts(with: "video/") {
                if let fileURL = pendingFile.fileURL {
                    if UIVideoAtPathIsCompatibleWithSavedPhotosAlbum(fileURL.path) {
                        UISaveVideoAtPathToSavedPhotosAlbum(fileURL.path, nil, nil, nil)
                    }
                }
            }
            
            call.resolve()
        } catch {
            call.reject("Error closing file: \(error)")
        }
    }
}
