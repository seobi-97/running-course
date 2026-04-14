import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'

export default createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  theme: {
    defaultTheme: 'runningLight',
    themes: {
      runningLight: {
        dark: false,
        colors: {
          primary: '#16a34a',
          secondary: '#2563eb',
          accent: '#0d9488',
          error: '#dc2626',
          warning: '#d97706',
          info: '#0284c7',
          success: '#15803d',
          background: '#f1f5f9',
          surface: '#ffffff',
        },
      },
    },
  },
  defaults: {
    VBtn: { variant: 'flat', rounded: 'lg' },
    VCard: { rounded: 'lg', elevation: 1 },
    VTextField: { variant: 'outlined', density: 'comfortable', hideDetails: 'auto' },
  },
})
