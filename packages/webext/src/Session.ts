// MIT License
//
// Copyright Inrupt Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
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

export interface ISessionOptions {
  /**
   * A private storage, unreachable to other extensions. Typically in-memory.
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
 * A {@link Session} object represents a user's session on an application. The session holds state, as it stores information enabling access to private resources after login.
 */
export class Session implements IHasSessionEventListener {
  /**
   * Information regarding the current session.
   */
  public readonly info: ISessionInfo;

  /**
   * Session attribute exposing the EventEmitter interface, to listen on session
   * events such as login, logout, etc.
   */
  public readonly events: ISessionEventListener;

  private readonly clientAuthentication: ClientAuthentication;

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
      this.clientAuthentication = getClientAuthenticationWithDependencies({
        secureStorage: sessionOptions.secureStorage,
        insecureStorage: sessionOptions.insecureStorage,
      });
    } else {
      this.clientAuthentication = getClientAuthenticationWithDependencies({});
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
   * @param options Parameter to customize the login behaviour. Only `options.oidcIssuer` specifying user's identity provider is required. `options.redirectUrl` is ignored if specified.
   * @returns A promise resolving when login process finishes.
   */
  login = async (options: ILoginInputOptions): Promise<void> => {
    return this.clientAuthentication
      .login(
        {
          sessionId: this.info.sessionId,
          ...options,
          tokenType: options.tokenType ?? "DPoP",
        },
        this.events,
      )
      .then((sessionInfo) => {
        this.setSessionInfo(sessionInfo);
        if (sessionInfo.isLoggedIn) {
          (this.events as EventEmitter).emit(EVENTS.LOGIN);
        }
      })
      .catch((err) => {
        this.info.isLoggedIn = false;
        (this.events as EventEmitter).emit(EVENTS.ERROR, "login", err);
        return Promise.reject(err);
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

  /**
   * An internal logout function, to control whether the logout signal
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
    if (emitSignal) {
      (this.events as EventEmitter).emit(EVENTS.LOGOUT);
    }
  };

  /**
   * Logs the user out of the application.
   *
   * It will log the user out within the application
   * by clearing any session data from the browser. It does
   * not log the user out of their Solid identity provider,
   * and will not redirect the user away.
   */
  logout = async (): Promise<void> =>
    this.internalLogout(true, { logoutType: "app" });

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
