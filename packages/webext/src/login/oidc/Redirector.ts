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
 * @packageDocumentation
 */

import type {
  IIncomingRedirectHandler,
  IRedirector,
  IRedirectorOptions,
  ISessionInfo,
} from "@inrupt/solid-client-authn-core";

import { getUnauthenticatedSession } from "../../sessionInfo/SessionInfoManager";

export type RedirectInfo = ISessionInfo & { fetch: typeof fetch };

export type RedirectCallback = (info: RedirectInfo, error?: Error) => void;

/**
 * @hidden
 */
export default class Redirector implements IRedirector {
  constructor(
    private readonly redirectHandler: IIncomingRedirectHandler,
    private readonly afterRedirect: RedirectCallback,
  ) {
    // nothing else to do
  }

  redirect(redirectUrl: string, _options?: IRedirectorOptions): void {
    browser.identity
      .launchWebAuthFlow({
        url: redirectUrl,
        interactive: true,
      })
      .then((url) => {
        return this.redirectHandler.handle(url, undefined, undefined);
      })
      .then((sessionInfo) => {
        this.afterRedirect(sessionInfo);
      })
      .catch((error) => {
        this.afterRedirect(getUnauthenticatedSession(), error);
      });
  }
}
