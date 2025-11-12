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

import { jest, it, describe, expect } from "@jest/globals";
import { EVENTS } from "@inrupt/solid-client-authn-core";
import type { ISessionInfo } from "@inrupt/solid-client-authn-core";
// eslint-disable-next-line import/no-unresolved
import { mockStorage } from "@inrupt/solid-client-authn-core/mocks";
import type EventEmitter from "events";
import { mockClientAuthentication } from "./__mocks__/ClientAuthentication";
import { Session } from "./Session";
import type ClientAuthentication from "./ClientAuthentication";

/* eslint-disable @typescript-eslint/ban-ts-comment */

jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response());

const TEST_REDIRECT_URL = "https://coolapp.com/redirect";
jest
  .spyOn(globalThis.browser.identity, "getRedirectURL")
  .mockReturnValue(TEST_REDIRECT_URL);

describe("Session", () => {
  describe("constructor", () => {
    it("accepts an empty config", async () => {
      const mySession = new Session({});
      expect(mySession.info.isLoggedIn).toBe(false);
      expect(mySession.info.sessionId).toBeDefined();
    });

    it("accepts no config", async () => {
      const mySession = new Session();
      expect(mySession.info.isLoggedIn).toBe(false);
      expect(mySession.info.sessionId).toBeDefined();
    });

    it("does not generate a session ID if one is provided", () => {
      const mySession = new Session({}, "mySession");
      expect(mySession.info.sessionId).toBe("mySession");
    });

    it("accepts input storage", async () => {
      const insecureStorage = mockStorage({});
      const secureStorage = mockStorage({});
      const mySession = new Session({
        insecureStorage,
        secureStorage,
      });
      const clearSecureStorage = jest.spyOn(secureStorage, "delete");
      const clearInsecureStorage = jest.spyOn(insecureStorage, "delete");
      await mySession.logout();
      expect(clearSecureStorage).toHaveBeenCalled();
      expect(clearInsecureStorage).toHaveBeenCalled();
    });

    it("accepts session info", () => {
      const mySession = new Session({
        sessionInfo: {
          sessionId: "mySession",
          isLoggedIn: false,
          webId: "https://some.webid",
        },
      });
      expect(mySession.info.isLoggedIn).toBe(false);
      expect(mySession.info.sessionId).toBe("mySession");
      expect(mySession.info.webId).toBe("https://some.webid");
    });

    it("does not reference window immediately", () => {
      // Let's make TypeScript and eslint angry! We'll set our window mock to
      // undefined so that any references to its properties or methods explode.
      // @ts-ignore-start

      window = undefined;
      // @ts-ignore-end
      expect(() => {
        new Session({});
      }).not.toThrow();
    });
  });

  describe("login", () => {
    const mockLoggedInSessionInfo: ISessionInfo = {
      isLoggedIn: true,
      sessionId: "test-session-id",
      webId: "https://pod.example.com/profile#me",
      clientAppId: "my-client-app-id",
      expirationDate: 1234567890,
    };

    const mockLoggedOutSessionInfo: ISessionInfo = {
      isLoggedIn: false,
      sessionId: "another-test-session-id",
      clientAppId: "my-other-client-app-id",
    };

    it.each([mockLoggedInSessionInfo, mockLoggedOutSessionInfo])(
      "returns resolved Promise when login process completes and updates session info acccordingly",
      async (resultingSessionInfo) => {
        // Arrange
        const mockClientAuth = {
          login: jest.fn(() => Promise.resolve(resultingSessionInfo)),
        };

        const testSession = new Session({
          clientAuthentication: mockClientAuth as any as ClientAuthentication,
        });

        // Act & Assert
        await expect(testSession.login({})).resolves.toBeUndefined();

        expect(testSession.info).toEqual(resultingSessionInfo);
      },
    );

    it("returns rejected Promise when login fails with error", async () => {
      // Arrange
      const testError = new Error("Login failed");
      const mockClientAuth = {
        login: jest.fn(() => Promise.reject(testError)),
        logout: jest.fn(),
      };

      const testSession = new Session({
        clientAuthentication: mockClientAuth as any as ClientAuthentication,
      });

      // Act & Assert
      await expect(testSession.login({})).rejects.toThrow("Login failed");

      expect(testSession.info.isLoggedIn).toBe(false);
    });

    it("preserves a binding to its Session instance", async () => {
      const clientAuthentication = mockClientAuthentication();
      const clientAuthnLogin = jest.spyOn(clientAuthentication, "login");
      const mySession = new Session({ clientAuthentication });
      const objectWithLogin = {
        login: mySession.login,
      };
      await objectWithLogin.login({});
      expect(clientAuthnLogin).toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    it("wraps up ClientAuthentication logout", async () => {
      const clientAuthentication = mockClientAuthentication();
      const clientAuthnLogout = jest.spyOn(clientAuthentication, "logout");
      const mySession = new Session({ clientAuthentication });
      await mySession.logout();
      expect(clientAuthnLogout).toHaveBeenCalled();
    });

    it("preserves a binding to its Session instance", async () => {
      const clientAuthentication = mockClientAuthentication();
      const clientAuthnLogout = jest.spyOn(clientAuthentication, "logout");
      const mySession = new Session({ clientAuthentication });
      const objectWithLogout = {
        logout: mySession.logout,
      };
      await objectWithLogout.logout();
      expect(clientAuthnLogout).toHaveBeenCalled();
    });

    it("updates the session's info", async () => {
      const clientAuthentication = mockClientAuthentication();
      const mySession = new Session({ clientAuthentication });
      mySession.info.isLoggedIn = true;
      await mySession.logout();
      expect(mySession.info.isLoggedIn).toBe(false);
    });
  });

  describe("fetch", () => {
    it("wraps up ClientAuthentication fetch if logged in", async () => {
      const clientAuthentication = mockClientAuthentication();
      const clientAuthnFetch = jest.spyOn(clientAuthentication, "fetch");
      const mySession = new Session({ clientAuthentication });
      mySession.info.isLoggedIn = true;
      await mySession.fetch("https://some.url");
      expect(clientAuthnFetch).toHaveBeenCalled();
    });

    it("preserves a binding to its Session instance", async () => {
      const clientAuthentication = mockClientAuthentication();
      const clientAuthnFetch = jest.spyOn(clientAuthentication, "fetch");
      const mySession = new Session({ clientAuthentication });
      mySession.info.isLoggedIn = true;
      const objectWithFetch = {
        fetch: mySession.fetch,
      };
      await objectWithFetch.fetch("https://some.url");
      expect(clientAuthnFetch).toHaveBeenCalled();
    });

    it("does not rebind window.fetch if logged out", async () => {
      const clientAuthentication = mockClientAuthentication();
      const mySession = new Session({ clientAuthentication });
      await mySession.fetch("https://some.url/");
      expect(fetch).toHaveBeenCalled();
    });
  });

  describe("events.on", () => {
    describe("login", () => {
      it("calls the registered callback on successful login", async () => {
        // Arrange
        const mockSessionInfo: ISessionInfo = {
          isLoggedIn: true,
          sessionId: "test-session-id",
        };

        const mockClientAuth = {
          login: jest.fn(() => Promise.resolve(mockSessionInfo)),
        };

        const testSession = new Session({
          clientAuthentication: mockClientAuth as any as ClientAuthentication,
        });

        const mockCallback = jest.fn();
        testSession.events.on(EVENTS.LOGIN, mockCallback);

        // Act
        await testSession.login({});

        // Assert
        expect(mockCallback).toHaveBeenCalled();
      });

      it("does not call the registered callback on unsuccessful login", async () => {
        // Arrange
        const mockSessionInfo: ISessionInfo = {
          isLoggedIn: false,
          sessionId: "test-session-id",
        };

        const mockClientAuth = {
          login: jest.fn(() => Promise.resolve(mockSessionInfo)),
        };

        const testSession = new Session({
          clientAuthentication: mockClientAuth as any as ClientAuthentication,
        });

        const mockCallback = jest.fn();
        testSession.events.on(EVENTS.LOGIN, mockCallback);

        // Act
        await testSession.login({});

        // Assert
        expect(mockCallback).not.toHaveBeenCalled();
      });

      it("calls the registered callback on login error", async () => {
        // Arrange
        const loginError = new Error("Test error");
        const mockClientAuth = {
          login: jest.fn(() => Promise.reject(loginError)),
          logout: jest.fn(),
        };

        const mySession = new Session({
          clientAuthentication: mockClientAuth as any,
        });

        const mockCallback = jest.fn();
        mySession.events.on(EVENTS.ERROR, mockCallback);

        // Act & Assert
        await expect(mySession.login({})).rejects.toThrow("Test error");
        expect(mockCallback).toHaveBeenCalledWith("login", loginError);
      });
    });

    describe("logout", () => {
      it("calls the registered callback on logout", async () => {
        const myCallback = jest.fn();
        const mySession = new Session({
          clientAuthentication: mockClientAuthentication(),
        });

        mySession.events.on(EVENTS.LOGOUT, myCallback);
        await mySession.logout();
        expect(myCallback).toHaveBeenCalled();
      });
    });

    describe("session expiration", () => {
      it("calls logout on session expiration", () => {
        // Arrange
        const mockClientAuth = {
          logout: jest.fn(),
        };

        const testSession = new Session({
          clientAuthentication: mockClientAuth as any as ClientAuthentication,
        });

        // Act
        (testSession.events as EventEmitter).emit(EVENTS.SESSION_EXPIRED);

        // Assert
        expect(mockClientAuth.logout).toHaveBeenCalled();
      });
    });

    describe("error", () => {
      it("calls logout on error", () => {
        // Arrange
        const mockClientAuth = {
          logout: jest.fn(),
        };

        const testSession = new Session({
          clientAuthentication: mockClientAuth as any as ClientAuthentication,
        });

        // Act
        (testSession.events as EventEmitter).emit(
          EVENTS.ERROR,
          "error",
          new Error("test error"),
        );

        // Assert
        expect(mockClientAuth.logout).toHaveBeenCalled();
      });
    });

    describe("session lifetime extension", () => {
      it("calls the registered callback on session lifetime extension", async () => {
        // Arrange
        const mockSessionInfo: ISessionInfo = {
          isLoggedIn: true,
          sessionId: "test-session-id",
          expirationDate: 1000,
        };

        const mockClientAuth = {
          login: jest.fn(() => Promise.resolve(mockSessionInfo)),
        };

        const testSession = new Session({
          clientAuthentication: mockClientAuth as any as ClientAuthentication,
        });
        await testSession.login({});

        // Act
        const now = Date.now();
        (testSession.events as EventEmitter).emit(
          EVENTS.SESSION_EXTENDED,
          1000,
        );

        // Assert
        expect(testSession.info.expirationDate).toBeGreaterThan(now);
      });
    });
  });
});
