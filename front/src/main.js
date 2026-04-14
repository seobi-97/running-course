import { createApp } from 'vue'
import './styles/global.css'
import App from './App.vue'
import vuetify from './plugins/vuetify.js'

createApp(App).use(vuetify).mount('#app')
