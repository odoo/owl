module.exports = {
  roots: ["<rootDir>/examples/web/static", "<rootDir>/tests"],
  transform: {
    "^.+\\.ts?$": "ts-jest"
  },
  testRegex: "(/tests/.*(test|spec))\\.ts?$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"]
};
