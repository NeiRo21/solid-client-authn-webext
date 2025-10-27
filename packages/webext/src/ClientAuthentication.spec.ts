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

import { jest, it, describe, expect, beforeEach } from "@jest/globals";
import { EventEmitter } from "events";
import type * as SolidClientAuthnCore from "@inrupt/solid-client-authn-core";

import {
  StorageUtility,
  USER_SESSION_PREFIX,
} from "@inrupt/solid-client-authn-core";

import {
  mockStorageUtility,
  mockStorage,
  mockIncomingRedirectHandler,
  mockLogoutHandler,
} from "@inrupt/solid-client-authn-core/mocks";

import {
  MockLoginHandlerResponse,
  mockLoginHandler,
} from "./login/__mocks__/LoginHandler";
import {
  mockSessionInfoManager,
  SessionInfoManagerMock,
} from "./sessionInfo/__mocks__/SessionInfoManager";
import ClientAuthentication from "./ClientAuthentication";
import { mockDefaultIssuerConfigFetcher } from "./login/oidc/__mocks__/IssuerConfigFetcher";

jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response());

const TEST_REDIRECT_URL = "https://coolapp.com/redirect";
jest
  .spyOn(globalThis.browser.identity, "getRedirectURL")
  .mockReturnValue(TEST_REDIRECT_URL);

jest.mock("@inrupt/solid-client-authn-core", () => {
  const actualCoreModule = jest.requireActual(
    "@inrupt/solid-client-authn-core",
  ) as typeof SolidClientAuthnCore;
  return {
    ...actualCoreModule,
  };
});

type SessionStorageOptions = {
  clientId: string;
  issuer: string;
};

const mockSessionStorage = async (
  sessionId: string,
  options: SessionStorageOptions = {
    clientId: "https://some.app/registration",
    issuer: "https://some.issuer",
  },
): Promise<StorageUtility> => {
  return new StorageUtility(
    mockStorage({
      [`${USER_SESSION_PREFIX}:${sessionId}`]: {
        isLoggedIn: "true",
        webId: "https://my.pod/profile#me",
      },
    }),
    mockStorage({
      [`${USER_SESSION_PREFIX}:${sessionId}`]: {
        clientId: options.clientId,
        issuer: options.issuer,
      },
    }),
  );
};

describe("ClientAuthentication", () => {
  const defaultMockStorage = mockStorageUtility({});
  const defaultMocks = {
    loginHandler: mockLoginHandler(),
    redirectHandler: mockIncomingRedirectHandler(),
    logoutHandler: mockLogoutHandler(defaultMockStorage),
    sessionInfoManager: mockSessionInfoManager(defaultMockStorage),
    issuerConfigFetcher: mockDefaultIssuerConfigFetcher(),
  };

  function getClientAuthentication(
    mocks: Partial<typeof defaultMocks> = defaultMocks,
  ): ClientAuthentication {
    return new ClientAuthentication(
      mocks.loginHandler ?? defaultMocks.loginHandler,
      mocks.redirectHandler ?? defaultMocks.redirectHandler,
      mocks.logoutHandler ?? defaultMocks.logoutHandler,
      mocks.sessionInfoManager ?? defaultMocks.sessionInfoManager,
      mocks.issuerConfigFetcher ?? defaultMocks.issuerConfigFetcher,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("login", () => {
    const mockEmitter = new EventEmitter();

    it("calls login, and defaults to a DPoP token", async () => {
      const clientAuthn = getClientAuthentication();
      await clientAuthn.login(
        {
          sessionId: "mySession",
          clientId: "coolApp",
          oidcIssuer: "https://idp.com",
          tokenType: "DPoP",
        },
        mockEmitter,
      );
      expect(defaultMocks.loginHandler.handle).toHaveBeenCalledWith({
        sessionId: "mySession",
        clientId: "coolApp",
        redirectUrl: "https://coolapp.com/redirect",
        oidcIssuer: "https://idp.com",
        clientName: "coolApp",
        clientSecret: undefined,
        handleRedirect: undefined,
        eventEmitter: mockEmitter,
        tokenType: "DPoP",
      });
    });

    it("returns session info returned by login handler", async () => {
      // Arrange
      const clientAuthn = getClientAuthentication();

      // Act
      const sessionInfo = await clientAuthn.login(
        {
          sessionId: "mySession",
          clientId: "coolApp",
          oidcIssuer: "https://idp.com",
          tokenType: "DPoP",
        },
        mockEmitter,
      );

      // Assert
      expect(sessionInfo).toEqual(MockLoginHandlerResponse);
    });

    it("updates fetch to one returned by login handler and bound to window", async () => {
      // Arrange
      const clientAuthn = getClientAuthentication();

      // Act
      await clientAuthn.login(
        {
          sessionId: "mySession",
          clientId: "coolApp",
          oidcIssuer: "https://idp.com",
          tokenType: "DPoP",
        },
        mockEmitter,
      );
      await clientAuthn.fetch("https://example.com");

      // Assert
      const mockedFetch = jest.mocked(globalThis.fetch);
      expect(mockedFetch.mock.contexts[0]).toBe(window);
    });

    it("requests a bearer token if specified", async () => {
      const clientAuthn = getClientAuthentication();
      await clientAuthn.login(
        {
          sessionId: "mySession",
          clientId: "coolApp",
          oidcIssuer: "https://idp.com",
          tokenType: "Bearer",
        },
        mockEmitter,
      );
      expect(defaultMocks.loginHandler.handle).toHaveBeenCalledWith({
        sessionId: "mySession",
        clientId: "coolApp",
        redirectUrl: "https://coolapp.com/redirect",
        oidcIssuer: "https://idp.com",
        clientName: "coolApp",
        clientSecret: undefined,
        handleRedirect: undefined,
        eventEmitter: mockEmitter,
        tokenType: "Bearer",
      });
    });

    it("should clear the local storage when logging in", async () => {
      const nonEmptyStorage = mockStorageUtility({
        someUser: { someKey: "someValue" },
      });
      await nonEmptyStorage.setForUser(
        "someUser",
        { someKey: "someValue" },
        { secure: true },
      );
      const clientAuthn = getClientAuthentication({
        sessionInfoManager: mockSessionInfoManager(nonEmptyStorage),
      });
      await clientAuthn.login(
        {
          sessionId: "someUser",
          tokenType: "DPoP",
          clientId: "coolApp",
          clientName: "coolApp Name",
          oidcIssuer: "https://idp.com",
        },
        mockEmitter,
      );
      await expect(
        nonEmptyStorage.getForUser("someUser", "someKey", { secure: true }),
      ).resolves.toBeUndefined();
      await expect(
        nonEmptyStorage.getForUser("someUser", "someKey", { secure: false }),
      ).resolves.toBeUndefined();
      // This test is only necessary until the key is stored safely
      await expect(
        nonEmptyStorage.get("clientKey", { secure: false }),
      ).resolves.toBeUndefined();
    });

    it("should not clear the local storage when logging in with prompt set to none", async () => {
      // Arrange
      const nonEmptyStorage = mockStorageUtility({
        someUser: { someKey: "someValue" },
      });
      await nonEmptyStorage.setForUser(
        "someUser",
        { someKey: "someValue" },
        { secure: false },
      );
      const clientAuthn = getClientAuthentication({
        sessionInfoManager: mockSessionInfoManager(nonEmptyStorage),
      });

      // Act
      await clientAuthn.login(
        {
          sessionId: "someUser",
          tokenType: "DPoP",
          clientId: "coolApp",
          clientName: "coolApp Name",
          oidcIssuer: "https://idp.com",
          prompt: "none",
        },
        mockEmitter,
      );

      // Assert
      expect(SessionInfoManagerMock.clear).not.toHaveBeenCalled();
      await expect(
        nonEmptyStorage.getForUser("someUser", "someKey", { secure: false }),
      ).resolves.toBe("someValue");
    });

    it("ignores redirect URL supplied by user", async () => {
      // Arrange
      const clientAuthn = getClientAuthentication();

      // Act
      await clientAuthn.login(
        {
          sessionId: "mySession",
          clientId: "coolApp",
          redirectUrl: "https://example.org",
          oidcIssuer: "https://idp.com",
          tokenType: "Bearer",
        },
        mockEmitter,
      );

      // Assert
      expect(defaultMocks.loginHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUrl: TEST_REDIRECT_URL,
        }),
      );
    });

    it("uses clientName when provided, otherwise falls back to clientId", async () => {
      const clientAuthn = getClientAuthentication();
      await clientAuthn.login(
        {
          sessionId: "mySession",
          clientId: "coolApp",
          clientName: "Cool App Name",
          oidcIssuer: "https://idp.com",
          tokenType: "DPoP",
        },
        mockEmitter,
      );
      expect(defaultMocks.loginHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "Cool App Name",
        }),
      );
    });

    it("falls back to clientId when clientName is not provided", async () => {
      const clientAuthn = getClientAuthentication();
      await clientAuthn.login(
        {
          sessionId: "mySession",
          clientId: "coolApp",
          oidcIssuer: "https://idp.com",
          tokenType: "DPoP",
        },
        mockEmitter,
      );
      expect(defaultMocks.loginHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "coolApp",
        }),
      );
    });

    it("throws error when login handler throws an error", async () => {
      // Arrange
      const mockError = new Error("Login failed");
      const loginHandler = mockLoginHandler();
      jest.spyOn(loginHandler, "handle").mockRejectedValue(mockError);

      const clientAuthn = getClientAuthentication({ loginHandler });

      // Act & Assert
      await expect(
        clientAuthn.login(
          {
            sessionId: "mySession",
            clientId: "coolApp",
            oidcIssuer: "https://idp.com",
            tokenType: "DPoP",
          },
          mockEmitter,
        ),
      ).rejects.toThrow(mockError);
    });

    it("throws error when login handler returns undefined", async () => {
      // Arrange
      const loginHandler = mockLoginHandler();
      jest.spyOn(loginHandler, "handle").mockResolvedValue(undefined);

      const clientAuthn = getClientAuthentication({ loginHandler });

      // Act & Assert
      await expect(
        clientAuthn.login(
          {
            sessionId: "mySession",
            clientId: "coolApp",
            oidcIssuer: "https://idp.com",
            tokenType: "DPoP",
          },
          mockEmitter,
        ),
      ).rejects.toThrow("Unexpected login failure: no session info returned");
    });

    it("throws error when session info manager throws an error", async () => {
      // Arrange
      jest
        .spyOn(SessionInfoManagerMock, "clear")
        .mockRejectedValue(new Error("Clear failed"));

      const clientAuthn = getClientAuthentication({
        sessionInfoManager: SessionInfoManagerMock,
      });

      // Act & Assert
      await expect(
        clientAuthn.login(
          {
            sessionId: "mySession",
            clientId: "coolApp",
            oidcIssuer: "https://idp.com",
            tokenType: "DPoP",
          },
          mockEmitter,
        ),
      ).rejects.toThrow("Clear failed");
    });
  });

  describe("fetch", () => {
    it("calls fetch", async () => {
      const clientAuthn = getClientAuthentication();
      await clientAuthn.fetch("https://html5zombo.com");
      expect(fetch).toHaveBeenCalledWith("https://html5zombo.com", undefined);
    });
  });

  describe("logout", () => {
    it("calls logout handler and restores fetch to unauthenticated version", async () => {
      // Arrange
      const clientAuthn = getClientAuthentication();

      // Act
      await clientAuthn.logout("mySession");
      await clientAuthn.fetch("https://example.com", {
        credentials: "omit",
      });

      // Assert
      expect(defaultMocks.logoutHandler.handle).toHaveBeenCalledWith(
        "mySession",
        undefined,
      );
      expect(fetch).toHaveBeenCalledWith("https://example.com", {
        credentials: "omit",
      });
    });
  });

  describe("getAllSessionInfo", () => {
    it("creates a session for the global user", async () => {
      const clientAuthn = getClientAuthentication();
      await expect(() => clientAuthn.getAllSessionInfo()).rejects.toThrow(
        "Not implemented",
      );
    });
  });

  describe("getSessionInfo", () => {
    it("creates a session for the global user", async () => {
      const sessionInfo = {
        isLoggedIn: "true",
        sessionId: "mySession",
        webId: "https://pod.com/profile/card#me",
      };
      const clientAuthn = getClientAuthentication({
        sessionInfoManager: mockSessionInfoManager(
          mockStorageUtility(
            {
              "solidClientAuthenticationUser:mySession": { ...sessionInfo },
            },
            true,
          ),
        ),
      });
      const session = await clientAuthn.getSessionInfo("mySession");
      // isLoggedIn is stored as a string under the hood, but deserialized as a boolean
      expect(session).toEqual({
        ...sessionInfo,
        isLoggedIn: true,
        tokenType: "DPoP",
      });
    });
  });

  describe("validateCurrentSession", () => {
    it("returns null if the current session has no stored issuer", async () => {
      const sessionId = "mySession";

      const mockedStorage = new StorageUtility(
        mockStorage({
          [`${USER_SESSION_PREFIX}:${sessionId}`]: {
            isLoggedIn: "true",
          },
        }),
        mockStorage({
          [`${USER_SESSION_PREFIX}:${sessionId}`]: {
            clientId: "https://some.app/registration",
          },
        }),
      );
      const clientAuthn = getClientAuthentication({
        sessionInfoManager: mockSessionInfoManager(mockedStorage),
      });

      await expect(
        clientAuthn.validateCurrentSession(sessionId),
      ).resolves.toBeNull();
    });

    it("returns null if the current session has no stored client ID", async () => {
      const sessionId = "mySession";
      const mockedStorage = new StorageUtility(
        mockStorage({
          [`${USER_SESSION_PREFIX}:${sessionId}`]: {
            isLoggedIn: "true",
            issuer: "https://some.issuer",
          },
        }),
        mockStorage({
          [`${USER_SESSION_PREFIX}:${sessionId}`]: {},
        }),
      );
      const clientAuthn = getClientAuthentication({
        sessionInfoManager: mockSessionInfoManager(mockedStorage),
      });

      await expect(
        clientAuthn.validateCurrentSession(sessionId),
      ).resolves.toBeNull();
    });

    it("returns the current session if all necessary information are available", async () => {
      const sessionId = "mySession";
      const mockedStorage = await mockSessionStorage(sessionId, {
        clientId: "https://some.app/registration",
        issuer: "https://some.issuer",
      });

      const clientAuthn = getClientAuthentication({
        sessionInfoManager: mockSessionInfoManager(mockedStorage),
      });

      await expect(
        clientAuthn.validateCurrentSession(sessionId),
      ).resolves.toStrictEqual(
        expect.objectContaining({
          issuer: "https://some.issuer",
          clientAppId: "https://some.app/registration",
          sessionId,
          webId: "https://my.pod/profile#me",
        }),
      );
    });
  });
});
