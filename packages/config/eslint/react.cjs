/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["./base.cjs", "plugin:react-hooks/recommended"],
  env: {
    browser: true,
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
