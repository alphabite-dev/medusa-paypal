# 📝 PayPal Plugin for Medusa

[![Discord](https://img.shields.io/badge/Join%20our%20Discord-Community%20Server-7289da.svg)](https://discord.gg/ZgBCYTMaVQ)
[![Documentation](https://img.shields.io/badge/Read%20the%20full-Documentation-blue.svg)](https://medusa-docs.alphabite.io/docs/category/paypal)

The Alphabite PayPal Plugin integrates PayPal payment processing into your Medusa store. It handles various payment flows, including capturing payments, managing refunds, and ensuring robust error handling.

---

## 🔢 Version Compatibility

Pick the plugin version that matches your Medusa backend version:

| Medusa Version     | Plugin Version | Install Command                              |
| ------------------ | -------------- | -------------------------------------------- |
| `>= 2.13.*`        | `latest`       | `npm install @alphabite/medusa-paypal`       |
| `< 2.13.*`         | `0.2.5`        | `npm install @alphabite/medusa-paypal@0.2.5` |

### Instructions

- **Medusa 2.13.\* and above:** Install the latest version of the plugin. This is the actively maintained release and is required for compatibility with the latest Medusa APIs.
- **Medusa below 2.13.\*:** Pin the plugin to version `0.2.5`. Later plugin versions rely on APIs introduced in Medusa 2.13 and will not work on older backends.

Before installing, verify your Medusa version:

```bash
npm list @medusajs/medusa
```

Then install the matching plugin version:

```bash
# Medusa >= 2.13.* (latest)
npm install @alphabite/medusa-paypal

# Medusa < 2.13.* (pinned)
npm install @alphabite/medusa-paypal@0.2.5
```

> ⚠️ Use the same plugin version across local, staging, and production to avoid runtime errors.

---

# 📝 PayPal Plugin for Medusa

[![Discord](https://img.shields.io/badge/Join%20our%20Discord-Community%20Server-7289da.svg)](https://discord.gg/ZgBCYTMaVQ)
[![Documentation](https://img.shields.io/badge/Read%20the%20full-Documentation-blue.svg)](https://medusa-docs.alphabite.io/docs/category/paypal)

The Alphabite PayPal Plugin integrates PayPal payment processing into your Medusa store. It handles various payment flows, including capturing payments, managing refunds, and ensuring robust error handling.

---

## 📚 Table of Contents

- [🎯 Core Features](#-core-features)
- [🧱 Compatibility](#-compatibility)
- [🛠 Common Use Cases](#-common-use-cases)
- [📦 Installation](#-installation)
- [⚙️ Plugin Options](#-plugin-options)
- [📖 Documentation](#-documentation)

---

## 🎯 Core Features

- ✅ Seamless PayPal payment integration
- 🔄 Handles various PayPal error states
- 💰 Supports refunds directly from Medusa Admin
- 🛒 Creates new order IDs for each payment attempt within the same payment intent
- 📦 Optional inclusion of shipping and customer data in PayPal orders

---

## 🧱 Compatibility

- **Backend:** Medusa v2+
- **Frontend:** Framework-agnostic (integrates with PayPal's SDK)
- **Admin:** Refund functionality integrated into Medusa Admin

---

## 🛠 Common Use Cases

- Accepting PayPal payments for products and services
- Managing payment captures and refunds efficiently
- Ensuring robust payment processing with comprehensive error handling

---

## 📖 Documentation

For complete documentation, visit our [PayPal Plugin Documentation](https://medusa-docs.alphabite.io/docs/category/paypal).

---

---

# 📦 Installation

This guide walks you through installing and configuring the Alphabite PayPal Plugin in your Medusa backend.

---

## 1. Install the Plugin

Install the package via npm:

```bash
npm install @alphabite/medusa-paypal
```

---

## 2. Register the Plugin

Add the plugin to your `medusa.config.ts` or `medusa-config.js`:

```ts
{
  plugins: [
    {
      resolve: "@alphabite/medusa-paypal",
      options: {
        clientId: process.env.PAYPAL_CLIENT_ID,
        clientSecret: process.env.PAYPAL_CLIENT_SECRET,
        isSandbox: process.env.PAYPAL_SANDBOX === "true",
        webhookId: process.env.PAYPAL_WEBHOOK_ID,
        includeShippingData: false,
        includeCustomerData: false,
      },
    },
  ],
  modules:[
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "./src/modules/paypal",
            id: "paypal",
            options: {
              clientId: process.env.PAYPAL_CLIENT_ID,
              clientSecret: process.env.PAYPAL_CLIENT_SECRET,
              isSandbox: process.env.PAYPAL_SANDBOX === "true",
              webhookId: process.env.PAYPAL_WEBHOOK_ID,
              includeShippingData: false,
              includeCustomerData: false,
            },
          },
        ],
      },
    },
  ]
};
```

---

## ⚙️ Plugin Options

The following options can be passed to the PayPal plugin in your `medusa-config.js` or `medusa.config.ts` file:

| Option                | Type      | Default | Description                                                                                     |
| --------------------- | --------- | ------- | ----------------------------------------------------------------------------------------------- |
| `clientId`            | `string`  |         | Required. Your PayPal API client ID.                                                            |
| `clientSecret`        | `string`  |         | Required. Your PayPal API client secret.                                                        |
| `isSandbox`           | `boolean` | `true`  | Whether to use the PayPal Sandbox environment for testing.                                      |
| `webhookId`           | `string`  |         | Optional. Your PayPal webhook ID. If provided, enables confirmation of payment captures.        |
| `includeShippingData` | `boolean` | `false` | Optional. If `true`, shipping data from the storefront order will be added to the PayPal order. |
| `includeCustomerData` | `boolean` | `false` | Optional. If `true`, customer data from the storefront order will be added to the PayPal order. |

---

## ✅ Compatibility

- Requires **Medusa v2**
- Compatible with both JS and TypeScript projects

---

## 🚀 Next Steps

👉 [Configuration Guide](https://medusa-docs.alphabite.io/docs/category/paypal)
👉 [Join our Discord Community](https://discord.gg/ZgBCYTMaVQ) for faster support

---

## 💻 Front End Integration

This guide explains how to integrate the PayPal payment flow into your Next.js storefront using `@paypal/react-paypal-js`.

### 1. Install Dependencies

Install the official PayPal React SDK:

```bash
npm install @paypal/react-paypal-js
```

### 2. Environment Variables

Ensure your public PayPal Client ID is available in your environment variables:

```env
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_paypal_client_id
```

### 3. Implementation Overview

The integration involves wrapping your payment form with `PayPalScriptProvider` and `PayPalCardFieldsProvider`.

#### Key Components:

- **`PayPalScriptProvider`**: Loads the PayPal SDK script.
- **`PayPalCardFieldsProvider`**: Manages the state and callbacks for the card fields.
- **`PayPalCardFieldsForm`**: Renders the secure input fields.

### 4. Code Example

Here is a simplified structure of how to implement the PayPal payment component, based on `shose-storefront/src/collections/form/checkout/paypal.tsx`:

```tsx
import {
  PayPalCardFieldsForm,
  PayPalCardFieldsProvider,
  PayPalScriptProvider,
  usePayPalCardFields,
} from "@paypal/react-paypal-js";
import { useState, useEffect } from "react";
// Import your internal hooks/utilities (e.g., sdk, usePlaceOrder)

export const PayPalPayment = ({ cart, onPaymentCompleted }) => {
  const [clientToken, setClientToken] = useState(null);

  // 1. Fetch Client Token from your backend
  useEffect(() => {
    const fetchClientToken = async () => {
      const response = await sdk.client.fetch("/store/paypal/client-token", {
        method: "POST",
      });
      setClientToken(response.clientToken);
    };
    fetchClientToken();
  }, []);

  // 2. Define Callbacks
  const createOrder = async () => {
    // Logic to initiate payment session and return order_id
    // e.g., sdk.store.payment.initiatePaymentSession(cart, { provider_id: "pp_paypal_paypal" })
    return order_id;
  };

  const onApprove = async (data) => {
    // Logic to finalize order after PayPal approval
    await placeOrder();
    onPaymentCompleted();
  };

  if (!clientToken) return <div>Loading...</div>;

  return (
    <PayPalScriptProvider
      options={{
        clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
        components: "card-fields",
        currency: "EUR",
        intent: "capture",
        dataClientToken: clientToken,
      }}
    >
      <PayPalCardFieldsProvider
        createOrder={createOrder}
        onApprove={onApprove}
        style={{
          input: {
            "font-size": "14px",
            "font-family": "Inter, sans-serif",
            color: "#111827",
          },
        }}
      >
        <PayPalCardFieldsForm />
        <SubmitButton />
      </PayPalCardFieldsProvider>
    </PayPalScriptProvider>
  );
};

const SubmitButton = () => {
  const { cardFieldsForm } = usePayPalCardFields();

  const handleClick = async () => {
    if (cardFieldsForm) {
      await cardFieldsForm.submit();
    }
  };

  return <button onClick={handleClick}>Pay Now</button>;
};
```

### 5. Payment Flow Details

1.  **Client Token**: You **must** fetch a client token from your Medusa backend (`/store/paypal/client-token`) and pass it to `PayPalScriptProvider`. This authorizes the client to perform actions on behalf of your account.
2.  **Create Order**: The `createOrder` callback is triggered when the user attempts to pay. It should initialize a payment session in Medusa and return the PayPal Order ID.
3.  **On Approve**: The `onApprove` callback runs after PayPal successfully authorizes the payment. Use this to complete the order in Medusa (e.g., `placeOrder`).
