// For ESLint's TypeScript program, which does not read .vue files. vue-tsc resolves the real components.
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent;
  export default component;
}
