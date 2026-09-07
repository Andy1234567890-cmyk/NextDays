import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
// Firebase muss VOR dem ersten Zugriff aus JS bereitstehen: `getMessaging()`
// wirft sonst „No Firebase App '[DEFAULT]' has been created". Auf Android
// erledigt das google-services-Plugin diesen Schritt beim Start selbst, auf
// iOS gibt es kein Gegenstueck — er gehoert hier in den AppDelegate.
import FirebaseCore

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Als ERSTES, noch vor React Native: der JS-Code richtet den
    // Nachrichtenempfang beim Laden des Bundles ein und trifft sonst auf eine
    // nicht konfigurierte Firebase-Instanz. Ohne `GoogleService-Info.plist` im
    // Bundle wirft das — die Datei liegt neben dieser hier und MUSS im
    // Xcode-Target stehen, sonst landet sie nicht in der App.
    FirebaseApp.configure()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "MyNextDaysOwner",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
