import AuthenticationServices
import Capacitor
import UIKit

/**
 * ASWebAuthenticationSession wrapper for Ally OAuth (Apple / Google / Facebook).
 * Captures redirects to the app custom scheme (`fr.atasoif.app`) and returns the URL to JS.
 */
@objc(OAuthSessionPlugin)
public class OAuthSessionPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "OAuthSessionPlugin"
    public let jsName = "OAuthSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
    ]

    private var authSession: ASWebAuthenticationSession?

    @objc func start(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let url = URL(string: urlString),
              let callbackScheme = call.getString("callbackScheme"),
              !callbackScheme.isEmpty
        else {
            call.reject("url and callbackScheme are required")
            return
        }

        if let existing = authSession {
            existing.cancel()
            authSession = nil
        }

        let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) {
            [weak self] callbackURL, error in
            defer { self?.authSession = nil }

            if let error = error as? ASWebAuthenticationSessionError,
               error.code == .canceledLogin
            {
                call.reject("canceled")
                return
            }
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            guard let callbackURL = callbackURL else {
                call.reject("missing callback url")
                return
            }
            call.resolve(["url": callbackURL.absoluteString])
        }

        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        authSession = session

        DispatchQueue.main.async {
            if !session.start() {
                call.reject("failed to start ASWebAuthenticationSession")
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        if let window = self.bridge?.webView?.window {
            return window
        }
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        if let window = scenes.flatMap({ $0.windows }).first(where: { $0.isKeyWindow }) {
            return window
        }
        return ASPresentationAnchor()
    }
}
