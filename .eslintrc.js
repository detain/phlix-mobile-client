module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Disable prettier plugin to avoid version conflict
    'prettier/prettier': 'off',
    // Allow intentionally-unused bindings prefixed with `_` (E3 placeholders,
    // ignored destructures). The base @react-native config already ignores
    // `_`-prefixed args + array destructures; this extends that to vars/caught
    // errors so a single `_` convention covers all of them.
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      },
    ],
  },
};
