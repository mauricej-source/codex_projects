/// <reference types="vite/client" />

interface Window {
  paypal?: {
    Buttons: (options: {
      style?: Record<string, string | number>;
      createOrder: () => Promise<string>;
      onApprove: (data: { orderID: string }) => Promise<void>;
    }) => { render: (selector: HTMLElement) => void };
  };
}
