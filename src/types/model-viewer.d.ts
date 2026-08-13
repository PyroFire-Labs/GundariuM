import type { DetailedHTMLProps, HTMLAttributes } from "react";

// @google/model-viewer registers a <model-viewer> custom element; this just
// tells JSX its attributes are legal. Only the subset actually used in this
// codebase is declared.
//
// React 19's types moved the JSX namespace under react/jsx-runtime instead
// of a bare global `JSX` — augmenting "react" here is what actually reaches
// react-jsx-transformed files (a `declare global { namespace JSX }` block,
// the pre-React-19 idiom, is silently ignored).
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          "camera-controls"?: boolean;
          "auto-rotate"?: boolean;
          "shadow-intensity"?: string;
          exposure?: string;
          poster?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};
