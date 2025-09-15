//
// Copyright Inrupt Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal in
// the Software without restriction, including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
// Software, and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
// INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
// PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
// SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//

// Copyright (c) 2024 codecentric AG

// Copyright (c) 2025 NeiRo21

/**
 * @hidden
 */
import type {
  ILoginInputOptions,
  ISessionInfo,
  IStorage,
  IHasSessionEventListener,
  ISessionEventListener,
  ILogoutOptions,
} from "@inrupt/solid-client-authn-core";
import { EVENTS } from "@inrupt/solid-client-authn-core";
import { v4 } from "uuid";
import EventEmitter from "events";
import type ClientAuthentication from "./ClientAuthentication";
import { getClientAuthenticationWithDependencies } from "./dependencies";
import type { RedirectCallback, RedirectInfo } from "./login/oidc/Redirector";

export interface ISessionOptions {
  /**
   * A private storage, unreachable to other scripts on the page. Typically in-memory.
   */
  secureStorage: IStorage;
  /**
   * A storage where non-sensitive information may be stored, potentially longer-lived than the secure storage.
   */
  insecureStorage: IStorage;
  /**
   * Details about the current session
   */
  sessionInfo: ISessionInfo;
  /**
   * An instance of the library core. Typically obtained using `getClientAuthenticationWithDependencies`.
   */
  clientAuthentication: ClientAuthentication;
}

/**
 * A {@link Session} object represents a user's session on an application. The session holds state, as it stores information enabling access to private resources after login for instance.
 */
export class Session implements IHasSessionEventListener {
  /**
   * Information regarding the current session.
   */
  public readonly info: ISessionInfo;

  /**
   * Session attribute exposing the EventEmitter interface, to listen on session
   * events such as login, logout, etc.
   * @since 1.15.0
   */
  public readonly events: ISessionEventListener;

  private readonly clientAuthentication: ClientAuthentication;

  private resolveLogin: (value: PromiseLike<void> | void) => void = (
    _value,
  ) => {};

  private rejectLogin: (reason?: Error) => void = (_reason) => {};

  /**
   * Session object constructor. Typically called as follows:
   *
   * ```typescript
   * const session = new Session();
   * ```
   *
   * See also [getDefaultSession](https://docs.inrupt.com/developer-tools/api/javascript/solid-client-authn-browser/functions.html#getdefaultsession).
   *
   * @param sessionOptions The options enabling the correct instantiation of
   * the session. Either both storages or clientAuthentication are required. For
   * more information, see {@link ISessionOptions}.
   * @param sessionId A string uniquely identifying the session.
   *
   */
  constructor(
    sessionOptions: Partial<ISessionOptions> = {},
    sessionId: string | undefined = undefined,
  ) {
    this.events = new EventEmitter();
    if (sessionOptions.clientAuthentication) {
      this.clientAuthentication = sessionOptions.clientAuthentication;
    } else if (sessionOptions.secureStorage && sessionOptions.insecureStorage) {
      this.clientAuthentication = getClientAuthenticationWithDependencies(
        this.redirectCallback,
        {
          secureStorage: sessionOptions.secureStorage,
          insecureStorage: sessionOptions.insecureStorage,
        },
      );
    } else {
      this.clientAuthentication = getClientAuthenticationWithDependencies(
        this.redirectCallback,
        {},
      );
    }

    if (sessionOptions.sessionInfo) {
      this.info = {
        sessionId: sessionOptions.sessionInfo.sessionId,
        isLoggedIn: false,
        webId: sessionOptions.sessionInfo.webId,
        clientAppId: sessionOptions.sessionInfo.clientAppId,
      };
    } else {
      this.info = {
        sessionId: sessionId ?? v4(),
        isLoggedIn: false,
      };
    }

    this.events.on(EVENTS.SESSION_EXPIRED, () => this.internalLogout(false));

    this.events.on(EVENTS.ERROR, () => this.internalLogout(false));
  }

  /**
   * Triggers the login process. Note that this method will redirect the user away from your app.
   *
   * @param options Parameter to customize the login behaviour. In particular, two options are mandatory: `options.oidcIssuer`, the user's identity provider, and `options.redirectUrl`, the URL to which the user will be redirected after logging in their identity provider.
   * @returns TODO
   */
  // Define these functions as properties so that they don't get accidentally re-bound.
  // Isn't Javascript fun?
  login = async (options: ILoginInputOptions): Promise<void> => {
    return new Promise((resolve, reject) => {
      this.resolveLogin = resolve;
      this.rejectLogin = reject;
      this.clientAuthentication
        .login(
          {
            sessionId: this.info.sessionId,
            ...options,
            // Defaults the token type to DPoP
            tokenType: options.tokenType ?? "DPoP",
          },
          this.events,
        )
        .catch((err) => reject(err));
    });
  };

  /**
   * Fetches data using available login information. If the user is not logged in, this will behave as a regular `fetch`. The signature of this method is identical to the [canonical `fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).
   *
   * @param url The URL from which data should be fetched.
   * @param init Optional parameters customizing the request, by specifying an HTTP method, headers, a body, etc. Follows the [WHATWG Fetch Standard](https://fetch.spec.whatwg.org/).
   */
  fetch: typeof fetch = (url, init) =>
    this.clientAuthentication.fetch(url, init);

  private readonly redirectCallback: RedirectCallback = (
    redirectInfo: RedirectInfo,
    error?: Error,
  ) => {
    const { fetch, ...info } = redirectInfo;
    this.setSessionInfo(info);
    if (error) {
      this.rejectLogin(error);
    } else {
      this.resolveLogin();
    }
    if (info.isLoggedIn) {
      this.fetch = fetch.bind(window);
      (this.events as EventEmitter).emit(EVENTS.LOGIN);
    }
  };

  /**
   * An internal logout function, to control whether or not the logout signal
   * should be sent, i.e. if the logout was user-initiated or is the result of
   * an external event.
   *
   * @hidden
   */
  private internalLogout = async (
    emitSignal: boolean,
    options?: ILogoutOptions,
  ): Promise<void> => {
    await this.clientAuthentication.logout(this.info.sessionId, options);
    this.info.isLoggedIn = false;
    this.fetch = (url, init) => this.clientAuthentication.fetch(url, init);
    if (emitSignal) {
      (this.events as EventEmitter).emit(EVENTS.LOGOUT);
    }
  };

  /**
   * Logs the user out of the application.
   *
   * There are 2 types of logout supported by this library,
   * `app` logout and `idp` logout.
   *
   * App logout will log the user out within the application
   * by clearing any session data from the browser. It does
   * not log the user out of their Solid identity provider,
   * and should not redirect the user away.
   * App logout can be performed as follows:
   * ```typescript
   * await session.logout({ logoutType: 'app' });
   * ```
   *
   * IDP logout will log the user out of their Solid identity provider,
   * and will redirect the user away from the application to do so. In order
   * for users to be redirected back to `postLogoutUrl` you MUST include the
   * `postLogoutUrl` value in the `post_logout_redirect_uris` field in the
   * [Client ID Document](https://docs.inrupt.com/ess/latest/security/authentication/#client-identifier-client-id).
   * IDP logout can be performed as follows:
   * ```typescript
   * await session.logout({
   *  logoutType: 'idp',
   *  // An optional URL to redirect to after logout has completed;
   *  // this MUST match a logout URL listed in the Client ID Document
   *  // of the application that is logged in.
   *  // If the application is logged in with a Client ID that is not
   *  // a URI dereferencing to a Client ID Document then users will
   *  // not be redirected back to the `postLogoutUrl` after logout.
   *  postLogoutUrl: 'https://example.com/logout',
   *  // An optional value to be included in the query parameters
   *  // when the IDP provider redirects the user to the postLogoutRedirectUrl.
   *  state: "my-state"
   * });
   * ```
   */
  logout = async (options?: ILogoutOptions): Promise<void> =>
    this.internalLogout(true, options);

  private setSessionInfo(sessionInfo: ISessionInfo): void {
    this.info.isLoggedIn = sessionInfo.isLoggedIn;
    this.info.webId = sessionInfo.webId;
    this.info.sessionId = sessionInfo.sessionId;
    this.info.clientAppId = sessionInfo.clientAppId;
    this.info.expirationDate = sessionInfo.expirationDate;
    if (this.info.isLoggedIn) {
      this.events.on(EVENTS.SESSION_EXTENDED, (expiresIn: number) => {
        this.info.expirationDate = Date.now() + expiresIn * 1000;
      });
    }
  }
}
