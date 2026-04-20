import { ProviderWebhookPayload } from "@medusajs/framework/types";

export type PayPalWebhookPayloadDataShape<
  E extends string,
  R extends Record<string, any>
> = {
  event_type: E;
  resource: R;
};

export type PayPalWebhookPayloadDataPaymentCaptureCompleted =
  PayPalWebhookPayloadDataShape<
    "PAYMENT.CAPTURE.COMPLETED",
    {
      id: string;
      status: string;
      amount: {
        value: string;
        currency_code: string;
      };
      custom_id: string;
    }
  >;

export type PayPalWebhookPayloadDataCheckoutOrderApproved =
  PayPalWebhookPayloadDataShape<
    "CHECKOUT.ORDER.APPROVED",
    {
      id: string;
      purchase_units: Array<{
        amount: {
          value: string;
          currency_code: string;
        };
        custom_id: string;
      }>;
    }
  >;

export type WebhookPayload = {
  data:
    | PayPalWebhookPayloadDataPaymentCaptureCompleted
    | PayPalWebhookPayloadDataCheckoutOrderApproved;
  rawData: any;
  headers: Record<string, any>;
} & ProviderWebhookPayload["payload"];
