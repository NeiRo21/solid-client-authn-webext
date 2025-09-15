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

// Copyright (c) 2025 NeiRo21

/**
 * @hidden
 * @packageDocumentation
 */

import type {
  ISessionInfo,
  ISessionInternalInfo,
  ILoginOptions,
} from "@inrupt/solid-client-authn-core";
import {
  isValidRedirectUrl,
  ClientAuthentication as ClientAuthenticationBase,
} from "@inrupt/solid-client-authn-core";
import type { EventEmitter } from "events";

/**
 * @hidden
 */
export default class ClientAuthentication extends ClientAuthenticationBase {
  // Define these functions as properties so that they don't get accidentally re-bound.
  // Isn't Javascript fun?
  login = async (
    options: ILoginOptions,
    eventEmitter: EventEmitter,
  ): Promise<void> => {
    // In order to get a clean start, make sure that the session is logged out
    // on login, except when doing a silent login so that Dynamic Client information
    // is preserved.
    if (options.prompt !== "none") {
      await this.sessionInfoManager.clear(options.sessionId);
    }

    if (
      options.redirectUrl === undefined ||
      !isValidRedirectUrl(options.redirectUrl)
    ) {
      throw new Error(
        `${options.redirectUrl} is not a valid redirect URL, it is either a malformed IRI, includes a hash fragment, or reserved query parameters ('code' or 'state').`,
      );
    }
    await this.loginHandler.handle({
      ...options,
      // If no clientName is provided, the clientId may be used instead.
      clientName: options.clientName ?? options.clientId,
      eventEmitter,
    });
  };

  // Collects session information from storage, and returns them. Returns null
  // if the expected information cannot be found.
  // Note that the ID token is not stored, which means the session information
  // cannot be validated at this point.
  validateCurrentSession = async (
    currentSessionId: string,
  ): Promise<(ISessionInfo & ISessionInternalInfo) | null> => {
    const sessionInfo = await this.sessionInfoManager.get(currentSessionId);
    if (
      sessionInfo === undefined ||
      sessionInfo.clientAppId === undefined ||
      sessionInfo.issuer === undefined
    ) {
      return null;
    }
    return sessionInfo;
  };
}
