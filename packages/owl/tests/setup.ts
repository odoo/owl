const originalConsoleInfo = console.info;

console.info = (...args: any[]) => {
  if (args[0] === `Owl is running in 'dev' mode.`) {
    return;
  }
  originalConsoleInfo.call(console, ...args);
};
