import Foundation
import UIKit
import AVFoundation
import Photos
import ReplayKit
import React

@objc(ViroViewRecorder)
class ViroViewRecorder: NSObject {
  
  private var assetWriter: AVAssetWriter?
  private var videoInput: AVAssetWriterInput?
  private var pixelBufferAdaptor: AVAssetWriterInputPixelBufferAdaptor?
  private var displayLink: CADisplayLink?
  private var isRecording = false
  private var startTime: CFTimeInterval = 0
  private var outputURL: URL?
  private var targetView: UIView?
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  /// Start recording a specific view by tag
  @objc
  func startRecording(_ viewTag: NSNumber, fileName: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      
      if self.isRecording {
        reject("ALREADY_RECORDING", "Recording is already in progress", nil)
        return
      }
      
      // Find the view by tag
      guard let rootView = RCTKeyWindow()?.rootViewController?.view,
            let view = rootView.viewWithTag(viewTag.intValue) else {
        reject("VIEW_NOT_FOUND", "Could not find view with tag \(viewTag)", nil)
        return
      }
      
      self.targetView = view
      
      // Set up output file
      let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let outputURL = documentsPath.appendingPathComponent("\(fileName).mp4")
      
      // Remove existing file
      try? FileManager.default.removeItem(at: outputURL)
      
      self.outputURL = outputURL
      
      // Set up AVAssetWriter
      do {
        let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
        
        let width = Int(view.bounds.width * view.contentScaleFactor)
        let height = Int(view.bounds.height * view.contentScaleFactor)
        
        // Ensure even dimensions
        let evenWidth = width % 2 == 0 ? width : width - 1
        let evenHeight = height % 2 == 0 ? height : height - 1
        
        let videoSettings: [String: Any] = [
          AVVideoCodecKey: AVVideoCodecType.h264,
          AVVideoWidthKey: evenWidth,
          AVVideoHeightKey: evenHeight,
          AVVideoCompressionPropertiesKey: [
            AVVideoAverageBitRateKey: 6000000,
            AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
          ]
        ]
        
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        input.expectsMediaDataInRealTime = true
        
        let pixelBufferAttributes: [String: Any] = [
          kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
          kCVPixelBufferWidthKey as String: evenWidth,
          kCVPixelBufferHeightKey as String: evenHeight
        ]
        
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
          assetWriterInput: input,
          sourcePixelBufferAttributes: pixelBufferAttributes
        )
        
        writer.add(input)
        
        self.assetWriter = writer
        self.videoInput = input
        self.pixelBufferAdaptor = adaptor
        
        // Start writing
        writer.startWriting()
        writer.startSession(atSourceTime: .zero)
        
        self.isRecording = true
        self.startTime = CACurrentMediaTime()
        
        // Start display link to capture frames
        self.displayLink = CADisplayLink(target: self, selector: #selector(self.captureFrame))
        self.displayLink?.preferredFramesPerSecond = 30
        self.displayLink?.add(to: .main, forMode: .common)
        
        resolve(["success": true, "message": "Recording started"])
        
      } catch {
        reject("WRITER_ERROR", "Failed to create asset writer: \(error.localizedDescription)", error)
      }
    }
  }
  
  @objc
  private func captureFrame() {
    guard isRecording,
          let view = targetView,
          let input = videoInput,
          let adaptor = pixelBufferAdaptor,
          input.isReadyForMoreMediaData else {
      return
    }
    
    let elapsed = CACurrentMediaTime() - startTime
    let presentationTime = CMTime(seconds: elapsed, preferredTimescale: 600)
    
    // Capture the view as an image
    let renderer = UIGraphicsImageRenderer(bounds: view.bounds)
    let image = renderer.image { ctx in
      view.drawHierarchy(in: view.bounds, afterScreenUpdates: false)
    }
    
    // Convert to pixel buffer
    guard let pixelBuffer = pixelBufferFromImage(image) else { return }
    
    adaptor.append(pixelBuffer, withPresentationTime: presentationTime)
  }
  
  private func pixelBufferFromImage(_ image: UIImage) -> CVPixelBuffer? {
    let width = Int(image.size.width * image.scale)
    let height = Int(image.size.height * image.scale)
    
    var pixelBuffer: CVPixelBuffer?
    let attributes: [String: Any] = [
      kCVPixelBufferCGImageCompatibilityKey as String: true,
      kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
    ]
    
    let status = CVPixelBufferCreate(
      kCFAllocatorDefault,
      width,
      height,
      kCVPixelFormatType_32BGRA,
      attributes as CFDictionary,
      &pixelBuffer
    )
    
    guard status == kCVReturnSuccess, let buffer = pixelBuffer else { return nil }
    
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    
    guard let context = CGContext(
      data: CVPixelBufferGetBaseAddress(buffer),
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
    ) else { return nil }
    
    // Flip context for proper orientation
    context.translateBy(x: 0, y: CGFloat(height))
    context.scaleBy(x: 1, y: -1)
    
    UIGraphicsPushContext(context)
    image.draw(in: CGRect(x: 0, y: 0, width: width, height: height))
    UIGraphicsPopContext()
    
    return buffer
  }
  
  /// Stop recording and return the file path
  @objc
  func stopRecording(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      
      if !self.isRecording {
        reject("NOT_RECORDING", "No recording in progress", nil)
        return
      }
      
      self.isRecording = false
      self.displayLink?.invalidate()
      self.displayLink = nil
      
      guard let writer = self.assetWriter,
            let input = self.videoInput else {
        reject("WRITER_ERROR", "Asset writer not initialized", nil)
        return
      }
      
      input.markAsFinished()
      
      writer.finishWriting { [weak self] in
        guard let self = self else { return }
        
        if writer.status == .completed {
          resolve([
            "success": true,
            "url": self.outputURL?.absoluteString ?? "",
            "path": self.outputURL?.path ?? ""
          ])
        } else {
          reject("WRITE_ERROR", "Failed to finish writing: \(writer.error?.localizedDescription ?? "Unknown error")", writer.error)
        }
        
        self.assetWriter = nil
        self.videoInput = nil
        self.pixelBufferAdaptor = nil
        self.targetView = nil
      }
    }
  }
}

// Helper to get key window
private func RCTKeyWindow() -> UIWindow? {
  if #available(iOS 13.0, *) {
    return UIApplication.shared.connectedScenes
      .filter { $0.activationState == .foregroundActive }
      .compactMap { $0 as? UIWindowScene }
      .first?.windows
      .first { $0.isKeyWindow }
  } else {
    return UIApplication.shared.keyWindow
  }
}
