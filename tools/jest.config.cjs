module.exports = {
  rootDir: "..",
  testMatch: ["<rootDir>/tools/**/*.test.ts"],
  transform: {
    "^.+\\.ts?$": "ts-jest",
  },
};
