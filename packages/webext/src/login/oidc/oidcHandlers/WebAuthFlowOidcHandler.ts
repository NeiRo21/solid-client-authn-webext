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

/**
 * Login handler implementing Authorization Code Flow with PKCE and using browser identity API.
 * Based on AuthorizationCodeWithPkceOidcHandler from @inrupt/solid-client-authn-browser, but
 * also handles the second part of the flow using redirect handler.
 */
import type {
  IIncomingRedirectHandler,
  IOidcHandler,
  IOidcOptions,
  IStorageUtility,
  LoginResult,
} from "@inrupt/solid-client-authn-core";
import { OidcClient } from "@inrupt/oidc-client-ext";

/**
 * @hidden
 * Authorization code flow spec: https://openid.net/specs/openid-connect-core-1_0.html#CodeFlowAuth
 * PKCE: https://tools.ietf.org/html/rfc7636
 * Identity API: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/identity
 */
export default class WebAuthFlowOidcHandler implements IOidcHandler {
  constructor(
    private readonly redirectHandler: IIncomingRedirectHandler,
    private readonly storageUtility: IStorageUtility,
  ) {
    // do nothing
  }

  async handle(oidcLoginOptions: IOidcOptions): Promise<LoginResult> {
    if (!this.parametersGuard(oidcLoginOptions)) {
      throw new Error("The authorization code grant requires a redirectUrl.");
    }

    return Promise.resolve(this.getOidcClient(oidcLoginOptions))
      .then((oidcClient) => oidcClient.createSigninRequest())
      .then((signingRequest) => {
        // eslint-disable-next-line no-underscore-dangle
        const state = signingRequest.state._id;
        // eslint-disable-next-line no-underscore-dangle
        const codeVerifier = signingRequest.state._code_verifier;
        const targetUrl = signingRequest.url.toString();
        return Promise.all([
          Promise.resolve(targetUrl),
          this.storageUtility.setForUser(state, {
            sessionId: oidcLoginOptions.sessionId,
          }),
          this.storageUtility.setForUser(oidcLoginOptions.sessionId, {
            codeVerifier,
            issuer: oidcLoginOptions.issuer.toString(),
            redirectUrl: oidcLoginOptions.redirectUrl,
            dpop: Boolean(oidcLoginOptions.dpop).toString(),
            keepAlive: (typeof oidcLoginOptions.keepAlive === "boolean"
              ? oidcLoginOptions.keepAlive
              : true
            ).toString(),
          }),
        ]);
      })
      .then((fulfillmentValues) =>
        browser.identity.launchWebAuthFlow({
          url: fulfillmentValues[0], // targetUrl
          interactive: true,
        }),
      )
      .then((url) => this.redirectHandler.handle(url, undefined, undefined));
  }

  private getOidcClient(oidcLoginOptions: IOidcOptions): OidcClient {
    /* eslint-disable camelcase */
    const oidcOptions = {
      authority: oidcLoginOptions.issuer.toString(),
      client_id: oidcLoginOptions.client.clientId,
      client_secret: oidcLoginOptions.client.clientSecret,
      redirect_uri: oidcLoginOptions.redirectUrl,
      response_type: "code",
      scope: oidcLoginOptions.scopes.join(" "),
      filterProtocolClaims: true,
      // The userinfo endpoint on NSS fails, so disable this for now
      // Note that in Solid, information should be retrieved from the
      // profile referenced by the WebId.
      loadUserInfo: false,
      code_verifier: true,
      prompt: oidcLoginOptions.prompt ?? "consent",
    };
    /* eslint-enable camelcase */

    return new OidcClient(oidcOptions);
  }

  private parametersGuard(
    oidcLoginOptions: IOidcOptions,
  ): oidcLoginOptions is IOidcOptions & { redirectUrl: string } {
    return (
      oidcLoginOptions.issuerConfiguration.grantTypesSupported !== undefined &&
      oidcLoginOptions.issuerConfiguration.grantTypesSupported.indexOf(
        "authorization_code",
      ) > -1 &&
      oidcLoginOptions.redirectUrl !== undefined
    );
  }

  async canHandle(oidcLoginOptions: IOidcOptions): Promise<boolean> {
    return this.parametersGuard(oidcLoginOptions);
  }
}
