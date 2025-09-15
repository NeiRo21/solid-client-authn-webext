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
import type {
  IIncomingRedirectHandler,
  IncomingRedirectResult,
  SessionConfig,
} from "core";
import type { EventEmitter } from "events";
import type { RedirectCallback } from "./Redirector";
import Redirector from "./Redirector";

const mockedHandle =
  jest.fn<
    (
      redirectUrl: string,
      eventEmitter: EventEmitter | undefined,
      sessionConfig: SessionConfig | undefined,
    ) => Promise<IncomingRedirectResult>
  >();
const mockRedirectHandler = {
  canHandle: jest.fn(),
  handle: mockedHandle,
} as any as IIncomingRedirectHandler;
const mockAfterRedirect = jest.fn<RedirectCallback>();

jest.useFakeTimers();

describe("Redirector", () => {
  const redirector = new Redirector(mockRedirectHandler, mockAfterRedirect);

  describe("redirect", () => {
    const TEST_REDIRECT_URL = "https://someUrl.com/redirect";
    const MOCK_REDIRECT_HANDLING_RESULT: IncomingRedirectResult = {
      isLoggedIn: true,
      sessionId: "mock-session-id",
      fetch,
    };

    it("should launch OAuth2 authentication flow", async () => {
      // Arrange
      jest
        .spyOn(browser.identity, "launchWebAuthFlow")
        .mockResolvedValueOnce(TEST_REDIRECT_URL);

      // Act
      redirector.redirect(TEST_REDIRECT_URL);

      // Assert
      await jest.runAllTimersAsync();
      expect(browser.identity.launchWebAuthFlow).toHaveBeenCalledTimes(1);
      expect(browser.identity.launchWebAuthFlow).toHaveBeenCalledWith({
        url: TEST_REDIRECT_URL,
        interactive: true,
      });
    });

    it("should call redirect handler if authentication succeeds", async () => {
      // Arrange
      jest
        .spyOn(browser.identity, "launchWebAuthFlow")
        .mockResolvedValueOnce(TEST_REDIRECT_URL);

      // Act
      redirector.redirect(TEST_REDIRECT_URL);

      // Assert
      await jest.runAllTimersAsync();
      expect(mockedHandle).toHaveBeenCalledTimes(1);
      expect(mockedHandle).toHaveBeenCalledWith(
        TEST_REDIRECT_URL,
        undefined,
        undefined,
      );
    });

    it("should call afterRedirect callback with error if authentication fails", async () => {
      // Arrange
      jest
        .spyOn(browser.identity, "launchWebAuthFlow")
        .mockRejectedValueOnce("test error");

      // Act
      redirector.redirect(TEST_REDIRECT_URL);

      // Assert
      await jest.runAllTimersAsync();
      expect(mockAfterRedirect).toHaveBeenCalledTimes(1);
      expect(mockAfterRedirect).toHaveBeenCalledWith(
        {
          isLoggedIn: false,
          sessionId: expect.anything(),
          fetch: expect.anything(),
        },
        "test error",
      );
    });

    it("should call afterRedirect callback if redirect handling is successful", async () => {
      // Arrange
      jest
        .spyOn(browser.identity, "launchWebAuthFlow")
        .mockResolvedValueOnce(TEST_REDIRECT_URL);
      mockedHandle.mockResolvedValueOnce(MOCK_REDIRECT_HANDLING_RESULT);

      // Act
      redirector.redirect(TEST_REDIRECT_URL);

      // Assert
      await jest.runAllTimersAsync();
      expect(mockAfterRedirect).toHaveBeenCalledTimes(1);
      expect(mockAfterRedirect).toHaveBeenCalledWith(
        MOCK_REDIRECT_HANDLING_RESULT,
      );
    });

    it("should call afterRedirect callback with error if redirect handling fails", async () => {
      // Arrange
      jest
        .spyOn(browser.identity, "launchWebAuthFlow")
        .mockResolvedValueOnce(TEST_REDIRECT_URL);
      mockedHandle.mockRejectedValueOnce("test error");

      // Act
      redirector.redirect(TEST_REDIRECT_URL);

      // Assert
      await jest.runAllTimersAsync();
      expect(mockAfterRedirect).toHaveBeenCalledTimes(1);
      expect(mockAfterRedirect).toHaveBeenCalledWith(
        {
          isLoggedIn: false,
          sessionId: expect.anything(),
          fetch: expect.anything(),
        },
        "test error",
      );
    });
  });
});
