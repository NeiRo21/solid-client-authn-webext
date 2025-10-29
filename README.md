# Solid authentication for web browser extensions

`solid-client-authn-webext` is a fork of Inrupt's [Solid client authentication libraries](https://github.com/inrupt/solid-client-authn-js) adapted for web browser extensions. This library implementation is mostly based on `@inrupt/solid-client-authn-browser`, and is inspired by [WebClip Chrome extension](https://github.com/codecentric/web-clip).

`solid-client-authn-webext` uses browser's [Identity API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/identity) to perform the first part of OAuth2 flow and obtain an authorization code - the rest is the same as in `@inrupt/solid-client-authn-browser`. See [Browser compatibility table](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/identity#browser_compatibility) for the list of supported browsers.

`solid-client-authn-webext` is currently placed in a `solid-client-authn-js` repository fork because it uses non-exported members of `@inrupt/solid-client-authn-core`. It is also easy to keep it up to date with the upstream this way.

## Usage

`solid-client-authn-webext`'s interface is almost identical to the ones of Inrupt's `solid-client-authn` libraries: the main difference is that redirects during the login process are handled internally by the library, so `Session.handleIncomingRedirect()` method is absent. Besides that, `IDP` logout isn't supported at the moment.

See [Inrupt JS SDK documentation](https://docs.inrupt.com/sdk/javascript-sdk) for information on using client libraries and building Solid applications.

### Example

```typescript
const solidSession = new Session();
solidSession
    .login({
        oidcIssuer: "https://solidcommunity.net",
        clientName: "TestWebExt",
    })
    .then(() => {
        if (solidSession.info.isLoggedIn) {
            // access a Solid pod e.g.
            const myDataset = await getSolidDataset(
                "https://somepod.solidcommunity.net/somepath",
                { fetch: solidSession.fetch }
            );
        } else {
            // shouldn't ever happen
            log.error('Login did not succeed for an unknown reason');
        }
    })
    .catch((err) => {
        console.error(err);
    });
```

### Required polyfills

Same as for `@inrupt/solid-client-authn-browser`: the library requires `events` Node.js module, so if you do not use Webpack or use version 5+, you'll need to install `events` npm package.

### node-solid-server compatibility

[node-solid-server 5.3.0](https://github.com/solid/node-solid-server/releases/tag/v5.3.0) or higher.

## Development

The library source code resides under `packages/webext`.

## See also

- [Inrupt documentation home](https://docs.inrupt.com/)
- [Solid community forum](https://forum.solidproject.org/)
