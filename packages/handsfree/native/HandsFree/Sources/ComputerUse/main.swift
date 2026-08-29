/// Computer Use: semantic AX and background-safe macOS computer use.
///
/// Four modes:
///   mcp          — run the MCP server over stdio
///   --check      — print permission status as JSON to stdout and exit
///   --list-apps  — print running regular apps as JSON to stdout and exit
///   --history-snapshot — print frontmost app/window metadata without a screenshot
///   (default)    — open the permission setup GUI

import AppKit
import ApplicationServices
import Foundation

setbuf(stdout, nil)

let args = CommandLine.arguments
let subcommand = args.count >= 2 ? args[1] : ""

switch subcommand {
case "mcp":
    if ProcessInfo.processInfo.environment["OPENWORK_COMPUTER_USE_CURSOR_OVERLAY"] == "0" {
        let server = MCPServer()
        await server.run()
    } else {
        await runMCPServerWithOverlay()
    }
case "--check":
    // Fresh process → fresh TCC read → always accurate.
    let status = ComputerUsePermissions.status()
    let json = "{\"ok\":\(status.ok),\"accessibility\":\(status.accessibility),\"screenRecording\":\(status.screenRecording)}"
    print(json)
    exit(0)
case "--list-apps":
    // Running regular apps (Dock-visible). Needs no TCC permissions, so this
    // is safe to call from the composer at any time.
    let runningApps = NSWorkspace.shared.runningApplications
        .filter { $0.activationPolicy == .regular }
    let apps = runningApps
        .compactMap(\.localizedName)
        .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    let appDetails = runningApps.compactMap { application -> [String: String]? in
        guard let name = application.localizedName,
              let bundleIdentifier = application.bundleIdentifier else { return nil }
        return ["name": name, "bundleIdentifier": bundleIdentifier]
    }.sorted {
        ($0["name"] ?? "").localizedCaseInsensitiveCompare($1["name"] ?? "") == .orderedAscending
    }
    let payload: [String: Any] = ["ok": true, "apps": apps, "appDetails": appDetails]
    let data = (try? JSONSerialization.data(withJSONObject: payload)) ?? Data("{\"ok\":false,\"apps\":[]}".utf8)
    print(String(decoding: data, as: UTF8.self))
    exit(0)
case "--history-snapshot":
    guard AXIsProcessTrusted() else {
        print("{\"ok\":false,\"error\":\"accessibility_not_granted\"}")
        exit(0)
    }
    guard let application = NSWorkspace.shared.frontmostApplication,
          let appName = application.localizedName,
          let bundleIdentifier = application.bundleIdentifier else {
        print("{\"ok\":false,\"error\":\"frontmost_application_unavailable\"}")
        exit(0)
    }
    let applicationElement = AXUIElementCreateApplication(application.processIdentifier)
    var windowValue: CFTypeRef?
    let windowResult = AXUIElementCopyAttributeValue(
        applicationElement,
        kAXFocusedWindowAttribute as CFString,
        &windowValue
    )
    guard windowResult == .success, let windowValue else {
        print("{\"ok\":false,\"error\":\"focused_window_unavailable\"}")
        exit(0)
    }
    let windowElement = unsafeBitCast(windowValue, to: AXUIElement.self)
    var titleValue: CFTypeRef?
    let titleResult = AXUIElementCopyAttributeValue(
        windowElement,
        kAXTitleAttribute as CFString,
        &titleValue
    )
    guard titleResult == .success, let windowTitle = titleValue as? String, !windowTitle.isEmpty else {
        print("{\"ok\":false,\"error\":\"window_title_unavailable\"}")
        exit(0)
    }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let payload: [String: Any] = [
        "ok": true,
        "appName": appName,
        "bundleIdentifier": bundleIdentifier,
        "windowTitle": windowTitle,
        "capturedAt": formatter.string(from: Date()),
    ]
    let data = (try? JSONSerialization.data(withJSONObject: payload))
        ?? Data("{\"ok\":false,\"error\":\"serialization_failed\"}".utf8)
    print(String(decoding: data, as: UTF8.self))
    exit(0)
default:
    await runPermissionSetupApp()
}

@MainActor
func runMCPServerWithOverlay() async {
    NSApplication.shared.setActivationPolicy(.accessory)
    let server = MCPServer()
    Task.detached {
        await server.run()
        await MainActor.run {
            NSApplication.shared.terminate(nil)
        }
    }
    NSApplication.shared.run()
}

@MainActor
func runPermissionSetupApp() async {
    NSApplication.shared.setActivationPolicy(.regular)
    let appDelegate = PermissionSetupAppDelegate()
    NSApplication.shared.delegate = appDelegate
    NSApplication.shared.run()
}
