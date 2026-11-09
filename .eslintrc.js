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
  overrides: [
    {
      // MW-123 (review mobile__gameux #8): the raw-hex ratchet. The audit
      // counted hundreds of hand-copied hex literals across the app; the
      // cure is a token family (src/theme/tokens.ts) plus a GROW-ONLY
      // converted-files list — a listed file may never carry a raw color
      // literal again (hex anywhere: StyleSheet values or JSX props), and a
      // file joins the list only by being converted, never by being born
      // raw. Estate precedent: the console client's check-i18n-hardcoded
      // pinned-file-list. rgba() composites stay legal per the tokens.ts
      // scope note (no alpha family until a design-tool consumer exists).
      files: [
        'src/screens/PlayerScreen.tsx',
        'src/components/syncplay/SyncPlayModal.tsx',
      ],
      rules: {
        // The base @react-native config sets no no-restricted-syntax
        // entries (verified against node_modules), so this override owns
        // the rule wholesale for the listed files — no inherited clause
        // is silently dropped.
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
            message:
              'Raw hex color literal is forbidden in a tokenized file (MW-123). Use a colors token from src/theme/tokens.ts.',
          },
        ],
      },
    },
  ],
};
