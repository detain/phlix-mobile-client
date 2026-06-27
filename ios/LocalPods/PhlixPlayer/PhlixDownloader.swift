// ios/LocalPods/PhlixPlayer/PhlixDownloader.swift
//
// UNTESTED-in-CI: no device/simulator build runs in this environment. The JS
// layer (src/services/DownloadService.ts) falls back to a simulated downloader
// when this native module is absent, so the app stays functional without it.
//
// Method signatures, event names and payload keys are kept IDENTICAL to the
// Android module (android/.../download/PhlixDownloaderModule.kt) and the TS
// interface (src/native/types.ts: PhlixDownloaderInterface + DOWNLOAD_EVENTS).
import Foundation
import React

@objc(PhlixDownloader)
class PhlixDownloader: RCTEventEmitter, URLSessionDownloadDelegate {

    // Event names — MUST match DOWNLOAD_EVENTS in src/native/types.ts.
    private static let kProgress = "PhlixDownloadProgress"
    private static let kComplete = "PhlixDownloadComplete"
    private static let kError = "PhlixDownloadError"
    private static let kPaused = "PhlixDownloadPaused"

    private var hasListeners = false

    // taskId -> in-flight download task.
    private var tasks: [String: URLSessionDownloadTask] = [:]
    // taskId -> final on-disk destination path.
    private var destinations: [String: String] = [:]
    // taskId -> resume data captured on pause/cancel-with-resume.
    private var resumeData: [String: Data] = [:]
    // Reverse lookup: URLSessionTask.taskIdentifier -> our taskId.
    private var identifierToTaskId: [Int: String] = [:]

    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.background(
            withIdentifier: "com.phlix.mobile.downloader"
        )
        config.isDiscretionary = false
        config.sessionSendsLaunchEvents = true
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    override func supportedEvents() -> [String]! {
        return [
            PhlixDownloader.kProgress,
            PhlixDownloader.kComplete,
            PhlixDownloader.kError,
            PhlixDownloader.kPaused,
        ]
    }

    override func startObserving() { hasListeners = true }
    override func stopObserving() { hasListeners = false }

    override func constantsToExport() -> [AnyHashable: Any]! {
        let docs = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true).first ?? ""
        return ["documentsPath": docs]
    }

    private func emit(_ name: String, _ body: [String: Any]) {
        guard hasListeners else { return }
        sendEvent(withName: name, body: body)
    }

    // MARK: - Exported methods (5-arg startDownload, mirrors TS interface)

    @objc(startDownload:url:localPath:resumeOffset:totalBytesHint:)
    func startDownload(
        _ taskId: String,
        url: String,
        localPath: String,
        resumeOffset: NSNumber,
        totalBytesHint: NSNumber
    ) {
        destinations[taskId] = localPath

        let task: URLSessionDownloadTask
        if let data = resumeData[taskId] {
            // Resume from previously captured resume data (preferred).
            // TODO(E4-native, UNTESTED-in-CI): resumeData embeds the ORIGINAL signed
            // URL, which may have expired after a long pause (-> 403). Android avoids
            // this by re-fetching the fresh signed URL + a Range header from the
            // offset. iOS should do the same (discard resumeData, start a ranged
            // request with `url`) when the embedded URL is stale.
            task = session.downloadTask(withResumeData: data)
            resumeData[taskId] = nil
        } else {
            guard let parsed = URL(string: url) else {
                emit(PhlixDownloader.kError, ["taskId": taskId, "error": "Invalid URL"])
                return
            }
            task = session.downloadTask(with: parsed)
        }

        tasks[taskId] = task
        identifierToTaskId[task.taskIdentifier] = taskId
        task.resume()
    }

    @objc(pauseDownload:)
    func pauseDownload(_ taskId: String) {
        guard let task = tasks[taskId] else { return }
        task.cancel(byProducingResumeData: { [weak self] data in
            guard let self = self else { return }
            if let data = data {
                self.resumeData[taskId] = data
            }
            let downloaded = task.countOfBytesReceived
            self.tasks[taskId] = nil
            self.emit(PhlixDownloader.kPaused, [
                "taskId": taskId,
                "downloadedBytes": downloaded,
            ])
        })
    }

    @objc(resumeDownload:)
    func resumeDownload(_ taskId: String) {
        // Resume reuses the captured resume data; the JS layer re-issues
        // startDownload, but support a direct resume too.
        guard let data = resumeData[taskId] else { return }
        let task = session.downloadTask(withResumeData: data)
        resumeData[taskId] = nil
        tasks[taskId] = task
        identifierToTaskId[task.taskIdentifier] = taskId
        task.resume()
    }

    @objc(cancelDownload:)
    func cancelDownload(_ taskId: String) {
        tasks[taskId]?.cancel()
        if let task = tasks[taskId] {
            identifierToTaskId[task.taskIdentifier] = nil
        }
        tasks[taskId] = nil
        resumeData[taskId] = nil
        destinations[taskId] = nil
    }

    @objc(deleteFile:resolver:rejecter:)
    func deleteFile(
        _ localPath: String,
        resolver resolve: RCTPromiseResolveBlock,
        rejecter reject: RCTPromiseRejectBlock
    ) {
        let fm = FileManager.default
        if fm.fileExists(atPath: localPath) {
            do {
                try fm.removeItem(atPath: localPath)
            } catch {
                reject("delete_failed", error.localizedDescription, error)
                return
            }
        }
        resolve(true)
    }

    // MARK: - URLSessionDownloadDelegate

    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        guard let taskId = identifierToTaskId[downloadTask.taskIdentifier] else { return }
        emit(PhlixDownloader.kProgress, [
            "taskId": taskId,
            "downloadedBytes": totalBytesWritten,
            "totalBytes": max(0, totalBytesExpectedToWrite),
        ])
    }

    func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        guard let taskId = identifierToTaskId[downloadTask.taskIdentifier] else { return }
        let dest = destinations[taskId] ?? location.path
        let fm = FileManager.default
        do {
            try? fm.removeItem(atPath: dest)
            try fm.moveItem(at: location, to: URL(fileURLWithPath: dest))
        } catch {
            emit(PhlixDownloader.kError, ["taskId": taskId, "error": error.localizedDescription])
            return
        }
        cleanup(taskId: taskId, identifier: downloadTask.taskIdentifier)
        emit(PhlixDownloader.kComplete, ["taskId": taskId, "localPath": dest])
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: Error?
    ) {
        guard let taskId = identifierToTaskId[task.taskIdentifier] else { return }
        if let error = error {
            // A user-initiated cancel(byProducingResumeData:) surfaces here too;
            // suppress when we already captured resume data (paused).
            let nsError = error as NSError
            if nsError.code == NSURLErrorCancelled && resumeData[taskId] != nil {
                return
            }
            cleanup(taskId: taskId, identifier: task.taskIdentifier)
            emit(PhlixDownloader.kError, ["taskId": taskId, "error": error.localizedDescription])
        }
    }

    private func cleanup(taskId: String, identifier: Int) {
        tasks[taskId] = nil
        destinations[taskId] = nil
        identifierToTaskId[identifier] = nil
    }
}
