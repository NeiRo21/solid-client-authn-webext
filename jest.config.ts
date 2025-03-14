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

import type { Config } from "jest";
import { createJsWithTsPreset, type JestConfigWithTsJest } from "ts-jest";

type ArrayElement<MyArray> = MyArray extends Array<infer T> ? T : never;

const baseConfig: ArrayElement<NonNullable<Config["projects"]>> = {
  roots: ["<rootDir>"],
  testMatch: ["**/*.spec.ts"],
  preset: "ts-jest",
  modulePathIgnorePatterns: ["dist/", "<rootDir>/examples/"],
  coveragePathIgnorePatterns: [".*.spec.ts", "dist/"],
  clearMocks: true,
  injectGlobals: false,
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^jose": require.resolve("jose"),
  },
};

// Required by @peculiar/webcrypto, which comes from the polyfills
// loaded in the setup file.
process.env.OPENSSL_CONF = "/dev/null";

const presetConfig = createJsWithTsPreset({});

const config: JestConfigWithTsJest = {
  ...presetConfig,
  reporters: ["default", "github-actions"],
  collectCoverage: true,
  coverageReporters: process.env.CI ? ["text", "lcov"] : ["text"],
  coverageThreshold: {
    global: {
      // branches: 100,
      // functions: 100,
      // lines: 100,
      // statements: 100,
    },
  },
  collectCoverageFrom: ["<rootDir>/packages/**/*.ts"],
  coveragePathIgnorePatterns: ["<rootDir>/packages/**/examples/**/*.ts"],
  projects: [
    {
      ...baseConfig,
      displayName: "core",
      roots: ["<rootDir>/packages/core"],
    },
    {
      ...baseConfig,
      displayName: "oidc-browser",
      // This combination of preset/transformIgnorePatterns enforces that both TS and
      // JS files are transformed to CJS, and that the transform also applies to the
      // dependencies in the node_modules, so that ESM-only dependencies are supported.
      preset: "ts-jest/presets/js-with-ts",
      // Deliberately allow including node_modules when transforming code. undici can
      // also be ignored, as it isn't necessary in the browser setting.
      transformIgnorePatterns: ["undici"],
      roots: ["<rootDir>/packages/oidc-browser"],
      // This test environment is an extension of jsdom. This module targets the
      // browser environment only, so tests only need to run in jsdom.
      // Currently, this is still required despite the polyfills in jest setup.
      // See comments in file.
      testEnvironment: "<rootDir>/tests/environment/customEnvironment.ts",
    },
    {
      ...baseConfig,
      // This combination of preset/transformIgnorePatterns enforces that both TS and
      // JS files are transformed to CJS, and that the transform also applies to the
      // dependencies in the node_modules, so that ESM-only dependencies are supported.
      preset: "ts-jest/presets/js-with-ts",
      displayName: "browser",
      roots: ["<rootDir>/packages/browser"],
      // Deliberately allow including node_modules when transforming code. undici can
      // also be ignored, as it isn't necessary in the browser setting.
      transformIgnorePatterns: ["undici"],
      // This test environment is an extension of jsdom. This module targets the
      // browser environment only, so tests only need to run in jsdom.
      // Currently, this is still required despite the polyfills in jest setup.
      // See comments in file.
      testEnvironment: "<rootDir>/tests/environment/customEnvironment.ts",
      // Enable injectGlobals here to support jest-mock-console
      // https://github.com/bpedersen/jest-mock-console/issues/32
      injectGlobals: true,
    },
    {
      ...baseConfig,
      displayName: "node",
      roots: ["<rootDir>/packages/node"],
      testEnvironment: "node",
    },
    {
      ...baseConfig,
      displayName: "e2e-node-script",
      roots: ["<rootDir>/e2e/node/script"],
      setupFiles: ["<rootDir>/e2e/node/jest.setup.ts"],
      setupFilesAfterEnv: [],
      slowTestThreshold: 30,
    },
    {
      ...baseConfig,
      displayName: "e2e-node-server",
      roots: ["<rootDir>/e2e/node/server"],
      setupFiles: ["<rootDir>/e2e/node/jest.setup.ts"],
      setupFilesAfterEnv: [],
      slowTestThreshold: 30,
    },
  ],
};

export default config;
