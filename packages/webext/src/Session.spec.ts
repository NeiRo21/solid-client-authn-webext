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

import { jest, it, describe, expect } from "@jest/globals";
import { EVENTS } from "@inrupt/solid-client-authn-core";
import { mockStorage } from "@inrupt/solid-client-authn-core/mocks";
import { mockClientAuthentication } from "./__mocks__/ClientAuthentication";
import { Session } from "./Session";

/* eslint-disable @typescript-eslint/ban-ts-comment */

jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response());

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
      // eslint-disable-next-line no-global-assign
      window = undefined;
      // @ts-ignore-end
      expect(() => {
        // eslint-disable-next-line no-new
        new Session({});
      }).not.toThrow();
    });
  });

  describe("login", () => {
    it("wraps up ClientAuthentication login", () => {
      const clientAuthentication = mockClientAuthentication();
      const clientAuthnLogin = jest.spyOn(clientAuthentication, "login");
      const mySession = new Session({ clientAuthentication });
      // login never resolves if there are no errors,
      // because a login redirects the user away from the page:
      // eslint-disable-next-line no-void
      void mySession.login({
        redirectUrl: "https://idp.com",
      });
      expect(clientAuthnLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUrl: "https://idp.com",
        }),
        mySession.events,
      );
    });

    it("Uses the token type provided (if any)", () => {
      const clientAuthentication = mockClientAuthentication();
      const clientAuthnLogin = jest.spyOn(clientAuthentication, "login");
      const mySession = new Session({ clientAuthentication });
      // login never resolves if there are no errors,
      // because a login redirects the user away from the page:
      // eslint-disable-next-line no-void
      void mySession.login({
        redirectUrl: "https://idp.com",
        tokenType: "Bearer",
      });
      expect(clientAuthnLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUrl: "https://idp.com",
          tokenType: "Bearer",
        }),
        mySession.events,
      );
    });

    it("preserves a binding to its Session instance", () => {
      const clientAuthentication = mockClientAuthentication();
      const clientAuthnLogin = jest.spyOn(clientAuthentication, "login");
      const mySession = new Session({ clientAuthentication });
      const objectWithLogin = {
        login: mySession.login,
      };
      // login never resolves if there are no errors,
      // because a login redirects the user away from the page:
      // eslint-disable-next-line no-void
      void objectWithLogin.login({
        redirectUrl: "https://idp.com",
      });
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
  });
});
