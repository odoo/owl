module.exports = {
  roots: ["<rootDir>/demo/static"],
  transform: {
    "^.+\\.ts?$": "ts-jest"
  },
  testRegex: "(/tests/.*(test|spec))\\.ts?$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"]
};
