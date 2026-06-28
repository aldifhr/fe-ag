import tailwindCanonicalClasses from 'eslint-plugin-tailwind-canonical-classes';

export default [
  {
    plugins: {
      'tailwind-canonical-classes': tailwindCanonicalClasses,
    },
    rules: {
      'tailwind-canonical-classes/tailwind-canonical-classes': [
        'warn',
        {
          cssPath: './app/globals.css',
        },
      ],
    },
  },
];