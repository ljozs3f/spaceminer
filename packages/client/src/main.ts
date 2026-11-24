import { createApp } from 'vue';
import App from './App.vue';
import { AudioEngine } from './audio/AudioEngine';
import { LocalStorageSaveRepository } from './persistence/LocalStorageSaveRepository';
import './styles.css';

createApp(App, { saves: new LocalStorageSaveRepository(), audio: new AudioEngine() }).mount('#app');
