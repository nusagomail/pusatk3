// Vite `?raw` imports (used to load docs/data/kategori-k3.csv in tests).
declare module '*.csv?raw' {
  const text: string;
  export default text;
}
