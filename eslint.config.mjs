import unjs from "eslint-config-unjs";

// https://github.com/unjs/eslint-config
export default unjs({
  ignores: ["integrations/**", "connectors/**", "**/.docs"],
  rules: {
    "unicorn/expiring-todo-comments": 0,
    "@typescript-eslint/no-non-null-assertion": 0,
    "unicorn/no-null": 0,
    "@typescript-eslint/no-unused-vars": 0,
  },
});
