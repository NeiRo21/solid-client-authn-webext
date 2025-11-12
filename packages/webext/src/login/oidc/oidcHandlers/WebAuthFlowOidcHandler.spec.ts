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

// Copyright (c) 2025 NeiRo21

import { jest, it, describe, expect, beforeEach } from "@jest/globals";

/**
 * Test for WebAuthFlowOidcHandler
 */
import type { IOidcOptions } from "@inrupt/solid-client-authn-core";
import { StorageUtility } from "@inrupt/solid-client-authn-core";
import {
  StorageUtilityMock,
  mockIncomingRedirectHandler,
  mockStorage,
  // eslint-disable-next-line import/no-unresolved
} from "@inrupt/solid-client-authn-core/mocks";

import WebAuthFlowOidcHandler from "./WebAuthFlowOidcHandler";
import canHandleTests from "./OidcHandlerCanHandleTest";
import { mockSessionInfoManager } from "../../../sessionInfo/__mocks__/SessionInfoManager";
import { standardOidcOptions } from "../__mocks__/IOidcOptions";

jest.mock("@inrupt/oidc-client-ext", () => {
  return {
    OidcClient: jest.fn(),
  };
});

const SIGNIN_URL = "https://someUrl.com/signin";
const EXPECTED_SIGNIN_REDIRECT_URL = "https://someUrl.com/redirect";

const mockOidcModule = (url: string = SIGNIN_URL, state = "test state") => {
  const oidcModule = jest.requireMock("@inrupt/oidc-client-ext") as any;
  oidcModule.OidcClient.mockReturnValue({
    createSigninRequest: jest
      .fn<() => Promise<{ url: string; state: string }>>()
      .mockResolvedValue({
        url,
        state,
      }),
  });
  return oidcModule;
};

jest
  .spyOn(globalThis.browser.identity, "launchWebAuthFlow")
  .mockResolvedValue(EXPECTED_SIGNIN_REDIRECT_URL);

describe("WebAuthFlowOidcHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultMocks = {
    redirectHandler: mockIncomingRedirectHandler(),
    sessionCreator: mockSessionInfoManager(StorageUtilityMock),
    storageUtility: StorageUtilityMock,
  };

  function getWebAuthFlowOidcHandler(
    mocks: Partial<typeof defaultMocks> = defaultMocks,
  ): WebAuthFlowOidcHandler {
    return new WebAuthFlowOidcHandler(
      mocks.redirectHandler ?? defaultMocks.redirectHandler,
      mocks.storageUtility ?? defaultMocks.storageUtility,
    );
  }

  describe("canHandle", () => {
    const webAuthFlowOidcHandler = getWebAuthFlowOidcHandler();
    canHandleTests.webAuthFlowOidcHandler.forEach((testConfig) => {
      it(testConfig.message, async () => {
        const value = await webAuthFlowOidcHandler.canHandle(
          testConfig.oidcOptions,
        );
        expect(value).toBe(testConfig.shouldPass);
      });
    });
  });

  describe("handle", () => {
    it("should launch OAuth1 authentication flow with PKCE", async () => {
      // Arrange
      mockOidcModule();
      const webAuthFlowOidcHandler = getWebAuthFlowOidcHandler();
      const oidcOptions: IOidcOptions = {
        ...standardOidcOptions,
        issuerConfiguration: {
          ...standardOidcOptions.issuerConfiguration,
          grantTypesSupported: ["authorization_code"],
        },
      };

      // Act
      await webAuthFlowOidcHandler.handle(oidcOptions);

      // Assert
      expect(browser.identity.launchWebAuthFlow).toHaveBeenCalledTimes(1);
      expect(browser.identity.launchWebAuthFlow).toHaveBeenCalledWith({
        url: SIGNIN_URL,
        interactive: true,
      });
    });

    it("should call redirect handler when auth flow succeeds", async () => {
      // Arrange
      mockOidcModule();
      const webAuthFlowOidcHandler = getWebAuthFlowOidcHandler();
      const oidcOptions: IOidcOptions = {
        ...standardOidcOptions,
        issuerConfiguration: {
          ...standardOidcOptions.issuerConfiguration,
          grantTypesSupported: ["authorization_code"],
        },
      };

      // Act
      await webAuthFlowOidcHandler.handle(oidcOptions);

      // Assert
      expect(defaultMocks.redirectHandler.handle).toHaveBeenCalledWith(
        EXPECTED_SIGNIN_REDIRECT_URL,
        undefined,
        undefined,
      );
    });

    it("should not call redirect handler and return rejected promise when auth flow fails with error", async () => {
      // Arrange
      jest
        .spyOn(browser.identity, "launchWebAuthFlow")
        .mockRejectedValueOnce("test error");

      mockOidcModule();
      const webAuthFlowOidcHandler = getWebAuthFlowOidcHandler();
      const oidcOptions: IOidcOptions = {
        ...standardOidcOptions,
        issuerConfiguration: {
          ...standardOidcOptions.issuerConfiguration,
          grantTypesSupported: ["authorization_code"],
        },
      };

      // Act & Assert
      await expect(webAuthFlowOidcHandler.handle(oidcOptions)).rejects.toBe(
        "test error",
      );
      expect(defaultMocks.redirectHandler.handle).toHaveBeenCalledTimes(0);
    });

    it("stores code verifier and redirect URL", async () => {
      mockOidcModule();
      const mockedStorage = new StorageUtility(
        mockStorage({}),
        mockStorage({}),
      );
      const webAuthFlowOidcHandler = getWebAuthFlowOidcHandler({
        storageUtility: mockedStorage,
      });
      const oidcOptions: IOidcOptions = {
        ...standardOidcOptions,
        redirectUrl: "https://app.example.com?someQuery=someValue",
        issuerConfiguration: {
          ...standardOidcOptions.issuerConfiguration,
          grantTypesSupported: ["authorization_code"],
        },
      };
      await webAuthFlowOidcHandler.handle(oidcOptions);
      await expect(
        mockedStorage.getForUser("mySession", "redirectUrl", {
          secure: false,
        }),
      ).resolves.toBe("https://app.example.com?someQuery=someValue");
      await expect(
        mockedStorage.getForUser("mySession", "codeVerifier", {
          secure: false,
        }),
      ).resolves.not.toBeNull();
    });

    it("passes on the 'prompt' option down to our OIDC client library implementation", async () => {
      const oidcModule = mockOidcModule();
      const webAuthFlowOidcHandler = getWebAuthFlowOidcHandler();
      const oidcOptions: IOidcOptions = {
        prompt: "none",
        ...standardOidcOptions,
        issuerConfiguration: {
          ...standardOidcOptions.issuerConfiguration,
          grantTypesSupported: ["authorization_code"],
        },
      };
      await webAuthFlowOidcHandler.handle(oidcOptions);
      expect(oidcModule.OidcClient).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "none",
        }),
      );
    });

    it("defaults the 'prompt' option to consent", async () => {
      const oidcModule = mockOidcModule();
      const webAuthFlowOidcHandler = getWebAuthFlowOidcHandler();
      const oidcOptions: IOidcOptions = {
        ...standardOidcOptions,
        issuerConfiguration: {
          ...standardOidcOptions.issuerConfiguration,
          grantTypesSupported: ["authorization_code"],
        },
      };
      await webAuthFlowOidcHandler.handle(oidcOptions);
      expect(oidcModule.OidcClient).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "consent",
        }),
      );
    });

    it("includes the provided scopes in the authorization request", async () => {
      const oidcModule = mockOidcModule();
      const webAuthFlowOidcHandler = getWebAuthFlowOidcHandler();
      const oidcOptions: IOidcOptions = {
        ...standardOidcOptions,
        issuerConfiguration: {
          ...standardOidcOptions.issuerConfiguration,
          grantTypesSupported: ["authorization_code"],
        },
        scopes: ["openid", "webid", "custom_scope"],
      };
      await webAuthFlowOidcHandler.handle(oidcOptions);
      expect(oidcModule.OidcClient).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "openid webid custom_scope",
        }),
      );
    });

    it("handles login when a client secret is present", async () => {
      // Arrange
      mockOidcModule();
      const webAuthFlowOidcHandler = getWebAuthFlowOidcHandler();
      const oidcOptions: IOidcOptions = {
        ...standardOidcOptions,
        client: {
          ...standardOidcOptions.client,
          clientType: "dynamic",
          clientSecret: "I can't cook because I only drink Soylent",
          expiresAt: 95618140501000,
        },
        issuerConfiguration: {
          ...standardOidcOptions.issuerConfiguration,
          grantTypesSupported: ["authorization_code"],
        },
      };

      // Act
      await webAuthFlowOidcHandler.handle(oidcOptions);

      // Assert
      expect(browser.identity.launchWebAuthFlow).toHaveBeenCalledTimes(1);
      expect(browser.identity.launchWebAuthFlow).toHaveBeenCalledWith({
        url: SIGNIN_URL,
        interactive: true,
      });
    });

    it("should return rejected promise when redirect url is missing", async () => {
      // Arrange
      mockOidcModule();
      const webAuthFlowOidcHandler = getWebAuthFlowOidcHandler();
      const oidcOptions: IOidcOptions = {
        ...standardOidcOptions,
        issuerConfiguration: {
          ...standardOidcOptions.issuerConfiguration,
          grantTypesSupported: ["authorization_code"],
        },
        redirectUrl: undefined,
      };

      // Act
      const result = webAuthFlowOidcHandler.handle(oidcOptions);

      // Assert
      await expect(result).rejects.toBeInstanceOf(Error);
      await expect(result).rejects.toHaveProperty(
        "message",
        "The authorization code grant requires a redirectUrl.",
      );

      expect(browser.identity.launchWebAuthFlow).toHaveBeenCalledTimes(0);
      expect(defaultMocks.redirectHandler.handle).toHaveBeenCalledTimes(0);
    });
  });
});
