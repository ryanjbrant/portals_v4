//
//  VideoMerger.swift
//  PortalsRaw
//
//  Native module for merging video segments using AVFoundation
//

import Foundation
import AVFoundation
import React

@objc(VideoMerger)
class VideoMerger: NSObject {
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
  func merge(_ videoPaths: [String],
             outputPath: String,
             resolver resolve: @escaping RCTPromiseResolveBlock,
             rejecter reject: @escaping RCTPromiseRejectBlock) {
    
    DispatchQueue.global(qos: .userInitiated).async {
      self.mergeVideos(paths: videoPaths, outputPath: outputPath) { result in
        switch result {
        case .success(let url):
          resolve(url.path)
        case .failure(let error):
          reject("MERGE_ERROR", error.localizedDescription, error)
        }
      }
    }
  }
  
  private func mergeVideos(paths: [String], outputPath: String, completion: @escaping (Result<URL, Error>) -> Void) {
    let composition = AVMutableComposition()
    
    guard let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
          let audioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
      completion(.failure(NSError(domain: "VideoMerger", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to create composition tracks"])))
      return
    }
    
    var currentTime = CMTime.zero
    
    for path in paths {
      // Handle both file:// URLs and plain paths
      let cleanPath = path.replacingOccurrences(of: "file://", with: "")
      let fileURL = URL(fileURLWithPath: cleanPath)
      
      let asset = AVURLAsset(url: fileURL)
      let duration = asset.duration
      let timeRange = CMTimeRange(start: .zero, duration: duration)
      
      do {
        // Add video track
        if let assetVideoTrack = asset.tracks(withMediaType: .video).first {
          try videoTrack.insertTimeRange(timeRange, of: assetVideoTrack, at: currentTime)
        }
        
        // Add audio track (may not exist)
        if let assetAudioTrack = asset.tracks(withMediaType: .audio).first {
          try audioTrack.insertTimeRange(timeRange, of: assetAudioTrack, at: currentTime)
        }
        
        currentTime = CMTimeAdd(currentTime, duration)
      } catch {
        completion(.failure(error))
        return
      }
    }
    
    // Export the merged video
    let outputURL = URL(fileURLWithPath: outputPath)
    
    // Remove existing file if present
    try? FileManager.default.removeItem(at: outputURL)
    
    guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
      completion(.failure(NSError(domain: "VideoMerger", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to create export session"])))
      return
    }
    
    exporter.outputURL = outputURL
    exporter.outputFileType = .mp4
    exporter.shouldOptimizeForNetworkUse = true
    
    exporter.exportAsynchronously {
      switch exporter.status {
      case .completed:
        completion(.success(outputURL))
      case .failed:
        completion(.failure(exporter.error ?? NSError(domain: "VideoMerger", code: 3, userInfo: [NSLocalizedDescriptionKey: "Export failed"])))
      case .cancelled:
        completion(.failure(NSError(domain: "VideoMerger", code: 4, userInfo: [NSLocalizedDescriptionKey: "Export cancelled"])))
      default:
        completion(.failure(NSError(domain: "VideoMerger", code: 5, userInfo: [NSLocalizedDescriptionKey: "Unknown export error"])))
      }
    }
  }
}
