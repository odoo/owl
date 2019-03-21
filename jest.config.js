module.exports = {
  roots: ["<rootDir>/src", "<rootDir>/examples/web/static", "<rootDir>/tests"],
  transform: {
    "^.+\\.ts?$": "ts-jest"
  },
  testRegex: "(/tests/.*(test|spec))\\.ts?$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"]
};
