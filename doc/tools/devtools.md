# Owl Devtools Browser extension

The owl devtools browser extension is an extension available on chrome or firefox which adds an owl tab
to the browser devtools in order to inspect all owl apps that are present on any web page, their components
and allows to interract with their data to a certain extend. There is also a profiler available to visualize
the components' lifecycle and be able to trace their origin.

## Install the extension

In the owl root folder:

```bash
npm install
```

For chrome:

```bash
npm run build:devtools-chrome
```

For firefox:

```bash
npm run build:devtools-firefox
```

You can also run:

```bash
npm run dev:devtools-chrome
```

or

```bash
npm run dev:devtools-firefox
```

to avoid recompiling owl and gain time if it has already been done.

To run the extension:

In google chrome: go to your chrome extensions admin panel, activate developer mode and click on `Load unpacked`.
Select the output folder (dist/devtools) and that's it, your extension is active!
There is a convenient refresh button on the extension card (still on the same admin page) to update your code.
Do note that if you got some problems, you may need to completly remove and reload the extension to completly refresh the extension.

In firefox: go to the address about:debugging#/runtime/this-firefox and click on `Load temporary Add-on...`.
Select any file of the output folder (dist/devtools) and that's it, your extension is active!
Here, you can use the reload button to refresh the extension.

Note that you may have to open another window or reload your tab to see the extension working.
Also note that the extension will only be active on pages that have a sufficient version of owl.
