import ExpoModulesCore
import UIKit
import AVFoundation
import ARKit

public class ArViewRecorderModule: Module {
  private var assetWriter: AVAssetWriter?
  private var videoInput: AVAssetWriterInput?
  private var pixelBufferAdaptor: AVAssetWriterInputPixelBufferAdaptor?
  private var displayLink: CADisplayLink?
  private var isRecording = false
  private var isPaused = false
  private var startTime: CFTimeInterval = 0
  private var pausedTime: CFTimeInterval = 0  // Accumulated paused time
  private var pauseStartTime: CFTimeInterval = 0  // When pause started
  private var outputURL: URL?
  private var targetView: UIView?
  private var currentViewTag: Int?
  private var outputWidth: Int = 0  // Target output width for scaled recording
  private var outputHeight: Int = 0  // Target output height for scaled recording

  public func definition() -> ModuleDefinition {
    Name("ArViewRecorder")

    // Start recording the AR view (captures specific view by tag)
    AsyncFunction("startRecording") { (viewTag: Int, fileName: String, promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self = self else {
          promise.reject("ERROR", "Module deallocated")
          return
        }

        if self.isRecording {
          promise.reject("ALREADY_RECORDING", "Recording is already in progress")
          return
        }

        // Find the specific view using React Native's tag system
        // The viewTag corresponds to the ViroARSceneNavigator which is what we want to capture
        guard let window = self.getKeyWindow(),
              let rootView = window.rootViewController?.view else {
          promise.reject("VIEW_NOT_FOUND", "Could not find root view")
          return
        }
        
        // Try to find the specific view by tag (React Native tags are stored as view.tag)
        var targetView: UIView? = nil
        
        // First try to find by tag directly in the hierarchy
        if let foundView = rootView.viewWithTag(viewTag) {
          targetView = foundView
          NSLog("[ArViewRecorder] Found view by tag: %d", viewTag)
        } else {
          // Look for ViroARSceneNavigator view in hierarchy
          // The AR view typically has a specific subview structure
          targetView = self.findARView(in: rootView)
          if targetView != nil {
            NSLog("[ArViewRecorder] Found AR view in hierarchy")
          }
        }
        
        // If no specific view found, fall back to root but log warning
        if targetView == nil {
          NSLog("[ArViewRecorder] WARNING: Could not find AR view, falling back to root view (will include UI)")
          targetView = rootView
        }

        self.targetView = targetView
        self.currentViewTag = viewTag

        // Set up output file
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let outputURL = documentsPath.appendingPathComponent("\(fileName).mp4")

        // Remove existing file
        try? FileManager.default.removeItem(at: outputURL)

        self.outputURL = outputURL

        // Set up AVAssetWriter
        do {
          let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)

          let rawWidth = Int(rootView.bounds.width * rootView.contentScaleFactor)
          let rawHeight = Int(rootView.bounds.height * rootView.contentScaleFactor)
          
          // Use original aspect ratio - Decart accepts any ratio
          var finalWidth = rawWidth
          var finalHeight = rawHeight
          
          // Ensure max dimension of 2160px for reasonable file size
          let maxDimension = 2160
          let maxSide = max(finalWidth, finalHeight)
          if maxSide > maxDimension {
            let downScale = Double(maxDimension) / Double(maxSide)
            finalWidth = Int(Double(finalWidth) * downScale)
            finalHeight = Int(Double(finalHeight) * downScale)
          }

          // Ensure even dimensions (required for H.264)
          let evenWidth = finalWidth % 2 == 0 ? finalWidth : finalWidth - 1
          let evenHeight = finalHeight % 2 == 0 ? finalHeight : finalHeight - 1
          
          NSLog("[ArViewRecorder] Raw: %dx%d, Output: %dx%d", rawWidth, rawHeight, evenWidth, evenHeight)

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
          self.outputWidth = evenWidth  // Store target dimensions
          self.outputHeight = evenHeight

          // Start writing
          writer.startWriting()
          writer.startSession(atSourceTime: .zero)

          self.isRecording = true
          self.isPaused = false
          self.startTime = CACurrentMediaTime()
          self.pausedTime = 0

          // Start display link to capture frames at 30fps for stability
          self.displayLink = CADisplayLink(target: self, selector: #selector(self.captureFrame))
          self.displayLink?.preferredFramesPerSecond = 30
          self.displayLink?.add(to: .main, forMode: .common)

          promise.resolve(["success": true, "message": "Recording started"])

        } catch {
          promise.reject("WRITER_ERROR", "Failed to create asset writer: \(error.localizedDescription)")
        }
      }
    }

    // Pause recording (keeps session open, stops capturing frames)
    AsyncFunction("pauseRecording") { (promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self = self else {
          promise.reject("ERROR", "Module deallocated")
          return
        }

        if !self.isRecording {
          promise.reject("NOT_RECORDING", "No recording in progress")
          return
        }

        if self.isPaused {
          promise.reject("ALREADY_PAUSED", "Recording is already paused")
          return
        }

        self.isPaused = true
        self.pauseStartTime = CACurrentMediaTime()
        
        promise.resolve(["success": true, "message": "Recording paused"])
      }
    }

    // Resume recording
    AsyncFunction("resumeRecording") { (promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self = self else {
          promise.reject("ERROR", "Module deallocated")
          return
        }

        if !self.isRecording {
          promise.reject("NOT_RECORDING", "No recording in progress")
          return
        }

        if !self.isPaused {
          promise.reject("NOT_PAUSED", "Recording is not paused")
          return
        }

        // Add the pause duration to our accumulated paused time
        let pauseDuration = CACurrentMediaTime() - self.pauseStartTime
        self.pausedTime += pauseDuration
        self.isPaused = false
        
        promise.resolve(["success": true, "message": "Recording resumed"])
      }
    }

    // Stop recording and return the file path
    AsyncFunction("stopRecording") { (promise: Promise) in
      DispatchQueue.main.async { [weak self] in
        guard let self = self else {
          promise.reject("ERROR", "Module deallocated")
          return
        }

        if !self.isRecording {
          promise.reject("NOT_RECORDING", "No recording in progress")
          return
        }

        self.isRecording = false
        self.isPaused = false
        self.displayLink?.invalidate()
        self.displayLink = nil

        guard let writer = self.assetWriter,
              let input = self.videoInput else {
          promise.reject("WRITER_ERROR", "Asset writer not initialized")
          return
        }

        input.markAsFinished()

        writer.finishWriting { [weak self] in
          guard let self = self else { return }

          DispatchQueue.main.async {
            if writer.status == .completed {
              promise.resolve([
                "success": true,
                "url": self.outputURL?.absoluteString ?? "",
                "path": self.outputURL?.path ?? ""
              ])
            } else {
              promise.reject("WRITE_ERROR", "Failed to finish writing: \(writer.error?.localizedDescription ?? "Unknown error")")
            }

            self.assetWriter = nil
            self.videoInput = nil
            self.pixelBufferAdaptor = nil
            self.targetView = nil
            self.pausedTime = 0
          }
        }
      }
    }

    // Check if recording is in progress
    Function("isRecording") { () -> Bool in
      return self.isRecording
    }

    // Check if recording is paused
    Function("isPaused") { () -> Bool in
      return self.isPaused
    }

    // Extract frames from a video file for thumbnail scrubber
    AsyncFunction("extractFrames") { (videoPath: String, count: Int, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        self.extractVideoFrames(path: videoPath, frameCount: count) { result in
          DispatchQueue.main.async {
            switch result {
            case .success(let frames):
              promise.resolve([
                "success": true,
                "frames": frames
              ])
            case .failure(let error):
              promise.reject("EXTRACT_ERROR", error.localizedDescription)
            }
          }
        }
      }
    }
  }

  // MARK: - Frame Extraction
  
  private func extractVideoFrames(path: String, frameCount: Int, completion: @escaping (Result<[String], Error>) -> Void) {
    // Clean path (remove file:// if present)
    let cleanPath = path.replacingOccurrences(of: "file://", with: "")
    let videoURL = URL(fileURLWithPath: cleanPath)
    
    print("[ArViewRecorder] Extracting frames from: \(cleanPath)")
    
    // Check if file exists
    guard FileManager.default.fileExists(atPath: cleanPath) else {
      print("[ArViewRecorder] Video file not found at path: \(cleanPath)")
      completion(.failure(NSError(domain: "ArViewRecorder", code: 2, userInfo: [NSLocalizedDescriptionKey: "Video file not found"])))
      return
    }
    
    let asset = AVURLAsset(url: videoURL)
    let generator = AVAssetImageGenerator(asset: asset)
    generator.appliesPreferredTrackTransform = true
    generator.requestedTimeToleranceBefore = CMTime(seconds: 0.5, preferredTimescale: 600)
    generator.requestedTimeToleranceAfter = CMTime(seconds: 0.5, preferredTimescale: 600)
    
    // Set thumbnail size (50pt width, aspect ratio preserved)
    generator.maximumSize = CGSize(width: 100, height: 180)
    
    let duration = asset.duration
    let durationSeconds = CMTimeGetSeconds(duration)
    
    print("[ArViewRecorder] Video duration: \(durationSeconds) seconds")
    
    guard durationSeconds > 0 else {
      print("[ArViewRecorder] Invalid video duration")
      completion(.failure(NSError(domain: "ArViewRecorder", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid video duration"])))
      return
    }
    
    // Calculate number of frames (at least 1, at most frameCount or 2 per second)
    let actualCount = max(1, min(frameCount, Int(durationSeconds * 2)))
    print("[ArViewRecorder] Will extract \(actualCount) frames")
    
    // Generate timestamps for evenly spaced frames
    var times: [NSValue] = []
    for i in 0..<actualCount {
      let fraction = actualCount == 1 ? 0.5 : Double(i) / Double(actualCount - 1)
      let timeSeconds = durationSeconds * fraction
      let time = CMTime(seconds: timeSeconds, preferredTimescale: 600)
      times.append(NSValue(time: time))
    }
    
    var completedCount = 0
    var frameDict: [Int: String] = [:]
    
    generator.generateCGImagesAsynchronously(forTimes: times) { requestedTime, image, actualTime, result, error in
      completedCount += 1
      
      if let error = error {
        print("[ArViewRecorder] Frame \(completedCount) error: \(error.localizedDescription)")
      }
      
      if let cgImage = image, result == .succeeded {
        let uiImage = UIImage(cgImage: cgImage)
        if let jpegData = uiImage.jpegData(compressionQuality: 0.6) {
          let base64 = jpegData.base64EncodedString()
          // Find index of this time
          let timeSeconds = CMTimeGetSeconds(requestedTime)
          let fraction = durationSeconds > 0 ? timeSeconds / durationSeconds : 0
          let index = min(actualCount - 1, Int(round(fraction * Double(actualCount - 1))))
          frameDict[index] = "data:image/jpeg;base64,\(base64)"
          print("[ArViewRecorder] Frame \(index) extracted successfully")
        }
      } else {
        print("[ArViewRecorder] Frame extraction failed with result: \(result.rawValue)")
      }
      
      // Check if all frames are done
      if completedCount >= times.count {
        // Sort by index and return
        let sortedFrames = (0..<actualCount).compactMap { frameDict[$0] }
        print("[ArViewRecorder] Extraction complete: \(sortedFrames.count) frames")
        completion(.success(sortedFrames))
      }
    }
  }

  @objc
  private func captureFrame() {
    // Don't capture frames if paused
    guard isRecording, !isPaused,
          let view = targetView,
          let input = videoInput,
          let adaptor = pixelBufferAdaptor,
          input.isReadyForMoreMediaData else {
      return
    }

    // Calculate presentation time, excluding paused time
    let elapsed = CACurrentMediaTime() - startTime - pausedTime
    let presentationTime = CMTime(seconds: elapsed, preferredTimescale: 600)

    // Capture at full native pixel resolution (points * scale factor)
    let targetSize = CGSize(width: outputWidth, height: outputHeight)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1.0  // Use exact pixel dimensions, no additional scaling
    
    let renderer = UIGraphicsImageRenderer(size: targetSize, format: format)
    let image = renderer.image { ctx in
      // Scale the context to match pixel size vs point size
      let scaleX = CGFloat(outputWidth) / view.bounds.width
      let scaleY = CGFloat(outputHeight) / view.bounds.height
      ctx.cgContext.scaleBy(x: scaleX, y: scaleY)
      view.drawHierarchy(in: view.bounds, afterScreenUpdates: false)
    }

    // Convert to pixel buffer at output dimensions
    guard let pixelBuffer = pixelBufferFromImage(image, width: outputWidth, height: outputHeight) else { return }

    adaptor.append(pixelBuffer, withPresentationTime: presentationTime)
  }

  private func pixelBufferFromImage(_ image: UIImage, width: Int, height: Int) -> CVPixelBuffer? {

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

  private func getKeyWindow() -> UIWindow? {
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
  
  // Find the AR view in the view hierarchy
  // ViroARSceneNavigator uses views with class names starting with "VRT" or containing "AR"
  private func findARView(in view: UIView) -> UIView? {
    let className = String(describing: type(of: view))
    
    // Look for ViroReact views (VRTARSceneNavigator, VRTScene, etc.) or ARKit views
    if className.hasPrefix("VRT") || className.contains("ARSCNView") || className.contains("ViroARSceneNavigator") {
      NSLog("[ArViewRecorder] Found AR view type: %@", className)
      return view
    }
    
    // Also check for ARSCNView which is the underlying ARKit view
    if let arView = view as? ARSCNView {
      NSLog("[ArViewRecorder] Found ARSCNView directly")
      return arView
    }
    
    // Recursively search subviews
    for subview in view.subviews {
      if let found = findARView(in: subview) {
        return found
      }
    }
    
    return nil
  }
}
