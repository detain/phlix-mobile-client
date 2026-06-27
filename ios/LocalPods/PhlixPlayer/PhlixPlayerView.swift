// ios/LocalPods/PhlixPlayer/PhlixPlayerView.swift
import AVKit
import AVFoundation
import React

@objc(PhlixPlayerView)
class PhlixPlayerView: RCTViewManager {
    override func view() -> UIView! {
        return PhlixPlayerViewWrapper()
    }

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}

class PhlixPlayerViewWrapper: UIView {
    private var player: AVPlayer?
    private var playerLayer: AVPlayerLayer?
    private var timeObserver: Any?
    private var playerItem: AVPlayerItem?

    // Event emitter
    @objc var onPlaybackEvent: RCTDirectEventBlock?
    @objc var onProgress: RCTDirectEventBlock?
    @objc var onError: RCTDirectEventBlock?

    // Properties
    @objc var src: String = "" {
        didSet { loadVideo() }
    }

    @objc var autoPlay: Bool = true
    @objc var startPosition: Double = 0

    // E3-native (UNTESTED in CI): selected subtitle VTT URL, "" = off.
    // AVPlayer cannot trivially side-load a remote sidecar WebVTT into a plain
    // AVURLAsset; full support needs an AVMutableComposition / AVAssetResourceLoader
    // sidecar pipeline. We store the selection and re-load so the seam is in place;
    // deep rendering is deferred and must be verified on-device.
    @objc var subtitleUrl: String = "" {
        didSet {
            // TODO(E3-native): render selected subtitleUrl via AVMutableComposition
            // (merge external WebVTT as a text track) or AVAssetResourceLoaderDelegate.
            // Re-load only when the source is already set and the value changed.
            if !src.isEmpty && oldValue != subtitleUrl {
                loadVideo()
            }
        }
    }

    // Volume and muted are handled via methods to avoid Objective-C selector conflicts
    private var _volume: Float = 1.0
    private var _muted: Bool = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupPlayer()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupPlayer()
    }

    private func setupPlayer() {
        playerLayer = AVPlayerLayer()
        playerLayer?.videoGravity = .resizeAspect
        playerLayer?.frame = bounds
        if let playerLayer = playerLayer {
            self.layer.addSublayer(playerLayer)
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        playerLayer?.frame = bounds
    }

    private func loadVideo() {
        guard !src.isEmpty else { return }

        // Clean up previous player
        cleanup()

        // Create asset and player item
        guard let url = URL(string: src) else {
            onError?(["error": "Invalid URL"])
            return
        }

        let asset = AVURLAsset(url: url)
        playerItem = AVPlayerItem(asset: asset)
        player = AVPlayer(playerItem: playerItem)

        playerLayer?.player = player

        // Apply current volume/muted state
        player?.volume = _volume
        player?.isMuted = _muted

        // Observe player status
        playerItem?.addObserver(self, forKeyPath: "status", options: [.new], context: nil)

        // Add time observer
        let interval = CMTime(seconds: 1.0, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        timeObserver = player?.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            self?.onProgress?([
                "currentTime": time.seconds,
                "duration": self?.playerItem?.duration.seconds ?? 0
            ])
        }

        // Seek to start position
        if startPosition > 0 {
            let seekTime = CMTime(seconds: startPosition, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
            player?.seek(to: seekTime)
        }

        if autoPlay {
            player?.play()
        }

        // Observe playback end
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(playerDidFinishPlaying),
            name: .AVPlayerItemDidPlayToEndTime,
            object: playerItem
        )
    }

    override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey : Any]?, context: UnsafeMutableRawPointer?) {
        if keyPath == "status" {
            if playerItem?.status == .readyToPlay {
                onPlaybackEvent?(["event": "ready"])
            } else if playerItem?.status == .failed {
                onError?(["error": playerItem?.error?.localizedDescription ?? "Unknown error"])
            }
        }
    }

    @objc private func playerDidFinishPlaying() {
        onPlaybackEvent?(["event": "ended"])
    }

    // React Native methods
    @objc func play() {
        player?.play()
        onPlaybackEvent?(["event": "play"])
    }

    @objc func pause() {
        player?.pause()
        onPlaybackEvent?(["event": "pause"])
    }

    @objc func seekTo(_ position: Double) {
        let time = CMTime(seconds: position, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        player?.seek(to: time)
    }

    @objc func updateVolume(_ volume: Float) {
        _volume = volume
        player?.volume = volume
    }

    @objc func updateMuted(_ muted: Bool) {
        _muted = muted
        player?.isMuted = muted
    }

    private func cleanup() {
        if let observer = timeObserver {
            player?.removeTimeObserver(observer)
            timeObserver = nil
        }
        if playerItem != nil {
            playerItem?.removeObserver(self, forKeyPath: "status")
        }
        NotificationCenter.default.removeObserver(self)
        player?.pause()
        player = nil
        playerItem = nil
    }

    deinit {
        cleanup()
    }
}
