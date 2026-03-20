import { defineConfig } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";

export default defineConfig([{
    plugins: {
        "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.node,
            describe: true,
            expect: true,
            test: true,
            beforeEach: true,
            beforeAll: true,
            afterEach: true,
            afterAll: true,
            jest: true,
        },

        parser: tsParser,
        ecmaVersion: 5,
        sourceType: "module",
    },

    rules: {
        "no-restricted-globals": ["error", "event", "self"],
        "no-const-assign": ["error"],
        "no-debugger": ["error"],
        "no-dupe-class-members": ["error"],
        "no-dupe-keys": ["error"],
        "no-dupe-args": ["error"],
        "no-dupe-else-if": ["error"],
        "no-unsafe-negation": ["error"],
        "no-duplicate-imports": ["error"],
        "valid-typeof": ["error"],

        "@typescript-eslint/no-unused-vars": ["error", {
            vars: "all",
            args: "none",
            ignoreRestSiblings: false,
            caughtErrors: "all",
        }],

        "no-restricted-syntax": ["error", {
            selector: "MemberExpression[object.name='test'][property.name='only']",
            message: "test.only(...) is forbidden",
        }, {
            selector: "MemberExpression[object.name='describe'][property.name='only']",
            message: "describe.only(...) is forbidden",
        }],
    },
}]);