declare namespace JSX {
  interface IntrinsicElements {
    "altcha-widget": {
      challenge?: string;
      onverified?: (event: any) => void;
      className?: string;
    };
  }
}