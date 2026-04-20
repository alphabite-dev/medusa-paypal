import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils";
import {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  RefundPaymentInput,
  RefundPaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types";
import { CaptureStatus, Order } from "@paypal/paypal-server-sdk";
import { WebhookPayload } from "./types";
import { PaypalCreateOrderInput, PaypalService } from "./paypal-core";
import { z } from "zod";

export interface PaypalPaymentError {
  code: string;
  message: string;
  retryable: boolean;
  avsCode?: string;
  cvvCode?: string;
}

const optionsSchema = z.object({
  clientId: z
    .string()
    .min(1, "PayPal client ID is required")
    .describe(
      "PayPal client ID used for authentication. This field is required."
    ),
  clientSecret: z.string().min(1, "PayPal client secret is required"),
  isSandbox: z.boolean().default(false),
  webhookId: z.string().optional(),
  includeShippingData: z.boolean().default(false),
  includeCustomerData: z.boolean().default(false),
});

export type AlphabitePaypalPluginOptionsType = z.infer<typeof optionsSchema>;

export type AlphabitePaypalPluginOptions = {
  /**
   * PayPal client ID used for authentication.
   * This field is required.
   */
  clientId: string;

  /**
   * PayPal client secret used for authentication.
   * This field is required.
   */
  clientSecret: string;

  /**
   * Whether to use PayPal’s sandbox environment for testing.
   * Default: false
   */
  isSandbox?: boolean;

  /**
   * PayPal webhook ID to validate incoming webhooks.
   * Optional.
   */
  webhookId?: string;

  /**
   * Whether to include shipping data in transactions and responses.
   * Default: false
   */
  includeShippingData?: boolean;

  /**
   * Whether to include customer data (e.g., name, email) in transactions and responses.
   * Default: false
   */
  includeCustomerData?: boolean;
};

type InjectedDependencies = {
  logger: Logger;
  paymentModuleService: any;
};

interface InitiatePaymentInputCustom
  extends Omit<InitiatePaymentInput, "data"> {
  data?: Pick<PaypalCreateOrderInput, "items" | "shipping_info" | "email">;
}

interface AuthorizePaymentInputData
  extends Pick<PaypalCreateOrderInput, "items" | "shipping_info" | "email"> {}

export default class PaypalModuleService extends AbstractPaymentProvider<AlphabitePaypalPluginOptionsType> {
  static identifier = "paypal";

  protected client: PaypalService;
  protected logger: Logger;
  protected paymentModuleService: any;

  constructor(
    container: InjectedDependencies,
    private readonly options: AlphabitePaypalPluginOptionsType
  ) {
    super(container, options);

    this.logger = container.logger;
    this.paymentModuleService = container.paymentModuleService;

    this.client = new PaypalService(this.options);
  }

  static validateOptions(options: AlphabitePaypalPluginOptionsType): void {
    const result = optionsSchema.safeParse(options);

    if (!result.success) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Invalid PayPal plugin options: ${result.error.message}`
      );
    }
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    try {
      if (!input.data) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Payment data is required"
        );
      }

      if (!input.data.id) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "PayPal order ID is required to capture payment"
        );
      }

      if (
        input.data.status === PaymentSessionStatus.CAPTURED ||
        input.data.status === "COMPLETED"
      ) {
        return {
          data: {
            ...input.data,
            status: PaymentSessionStatus.CAPTURED,
            captured_at: new Date().toISOString(),
          },
        };
      }

      const id = input.data.id as string;

      await this.client.captureOrder(id);

      return {
        data: {
          ...input.data,
          status: PaymentSessionStatus.CAPTURED,
          captured_at: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error("PayPal capture payment error:", error);

      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Failed to capture PayPal payment"
      );
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    if (!input.data) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Payment data is required"
      );
    }

    const data = input.data as unknown as AuthorizePaymentInputData | undefined;

    let paypalData = input.data as Order | undefined;

    const amount = input.data.amount as number;
    const currencyCode = input.data.currency_code as string;
    const orderId = paypalData?.id as string;

    if (!orderId || !amount || !currencyCode) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "PayPal order ID, Amount or Currency is missing, can not capture order."
      );
    }

    const isAuthorized =
      paypalData?.purchaseUnits?.[0].payments?.captures?.[0]?.status ===
      CaptureStatus.Completed;

    if (!isAuthorized) {
      try {
        paypalData = await this.client.captureOrder(orderId);
      } catch (err) {
        const body = JSON.parse(err?.body || "{}");

        const captureData = body?.purchase_units?.[0]?.payments?.captures?.[0];

        const newOrder = await this.client.createOrder({
          amount: Number(amount),
          currency: currencyCode,
          sessionId: input.context?.idempotency_key,
          items: data?.items,
          shipping_info: data?.shipping_info,
          email: data?.email,
        });

        if (!captureData) {
          const error: PaypalPaymentError = {
            code: "404",
            message:
              "Payment declined. Please try again or use a different card.",
            retryable: true,
          };

          return {
            status: PaymentSessionStatus.PENDING,
            data: {
              ...input.data,
              ...newOrder,
              error,
            },
          };
        }

        const paymentStatus = captureData?.status || CaptureStatus.Declined;
        const processorResponse = captureData?.processorResponse;

        const { error = undefined } = this.checkPaymentStatus(
          paymentStatus,
          processorResponse
        );

        return {
          status: PaymentSessionStatus.PENDING,
          data: {
            ...input.data,
            ...newOrder,
            error,
          },
        };
      }

      const captureData = paypalData.purchaseUnits?.[0].payments?.captures?.[0];

      const paymentStatus = captureData?.status || CaptureStatus.Declined;
      const processorResponse = captureData?.processorResponse;

      const { status, error = undefined } = this.checkPaymentStatus(
        paymentStatus,
        processorResponse
      );

      if (status === CaptureStatus.Declined) {
        const newOrder = await this.client.createOrder({
          amount: Number(captureData?.amount?.value),
          currency: captureData?.amount?.currencyCode!,
          sessionId: input.context?.idempotency_key,
          items: data?.items,
          shipping_info: data?.shipping_info,
          email: data?.email,
        });

        return {
          status: PaymentSessionStatus.PENDING,
          data: {
            ...input.data,
            ...newOrder,
            error,
          },
        };
      }
    }

    return {
      data: {
        ...paypalData,
      },
      status: PaymentSessionStatus.AUTHORIZED,
    };
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    try {
      if (!input.data) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Payment data is required"
        );
      }

      const orderId = input.data["id"] as string;

      if (!orderId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Cancel payment failed! PayPal order ID and capture ID is required to cancel payment"
        );
      }

      return {
        data: {
          order_id: orderId,
          status: PaymentSessionStatus.CANCELED,
          cancelled_at: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error("PayPal cancel payment error:", error);

      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Failed to cancel PayPal payment"
      );
    }
  }

  async initiatePayment(
    input: InitiatePaymentInputCustom
  ): Promise<InitiatePaymentOutput> {
    try {
      if (!input.data) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Payment data is required"
        );
      }

      const { amount, currency_code, context, data } = input;

      if (!amount || !currency_code) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Amount and currency code are required"
        );
      }

      const order = await this.client.createOrder({
        amount: Number(amount),
        currency: currency_code,
        sessionId: context?.idempotency_key,
        items: data?.items,
        shipping_info: data?.shipping_info,
        email: data?.email,
      });

      return {
        data: { ...data, ...order, ...context, amount, currency_code },

        id: order.id!,
      };
    } catch (error) {
      this.logger.error("PayPal initiate payment error:", error);
      throw error;
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    try {
      if (!input.data) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Payment data is required"
        );
      }

      const orderId = input.data["id"] as string;
      const purchaseUnits =
        (input?.data?.["purchaseUnits"] as Order["purchaseUnits"]) || [];

      const captureIds = purchaseUnits
        ?.flatMap((item) =>
          item?.payments?.captures?.map((capture) => capture.id)
        )
        .filter((id) => id !== undefined);

      if (!orderId || !captureIds) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Refund payment failed! PayPal order ID and capture ID is required to cancel payment"
        );
      }

      await this.client.refundPayment(captureIds);

      return {
        data: {
          order_id: orderId,
          status: PaymentSessionStatus.CANCELED,
          cancelled_at: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error("PayPal refund payment error:", error);

      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Failed to refund PayPal payment"
      );
    }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    try {
      if (!input.data) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Payment data is required"
        );
      }

      const orderId = input.data["id"] as string;

      if (!orderId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Delete payment failed! PayPal order ID and capture ID is required to cancel payment"
        );
      }

      return {
        data: {
          order_id: orderId,
          status: PaymentSessionStatus.CANCELED,
          cancelled_at: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error("PayPal cancel payment error:", error);
      throw error;
    }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    try {
      if (!input.data) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Payment data is required"
        );
      }

      const order_id = input.data["id"] as string;

      if (!order_id) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "PayPal order ID is required to cancel payment"
        );
      }

      const order = await this.client.retrieveOrder(order_id);

      if (!order || !order.status) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `PayPal order with ID ${order_id} not found`
        );
      }

      return {
        status:
          order.status === "COMPLETED"
            ? PaymentSessionStatus.CAPTURED
            : PaymentSessionStatus.AUTHORIZED,
      };
    } catch (error) {
      this.logger.error("PayPal get payment status error:", error);
      throw error;
    }
  }

  async retrievePayment(input: Record<string, unknown>) {
    try {
      const id = input["id"] as string;

      const res = await this.client.retrieveOrder(id);
      return {
        data: { response: res },
      };
    } catch (error) {
      this.logger.error("PayPal retrieve payment error:", error);
      throw error;
    }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Not implemented");
  }

  async getWebhookActionAndData(
    payload: WebhookPayload
  ): Promise<WebhookActionResult> {
    try {
      const { data, headers } = payload;

      await this.client.verifyWebhook({ headers, body: data });

      switch (data.event_type) {
        case "CHECKOUT.ORDER.APPROVED": {
          const purchaseUnit = data.resource.purchase_units[0];
          return {
            action: "authorized",
            data: {
              session_id: purchaseUnit.custom_id,
              amount: Number(purchaseUnit.amount.value),
            },
          };
        }
        case "PAYMENT.CAPTURE.COMPLETED":
          return {
            action: "captured",
            data: {
              session_id: data.resource.custom_id,
              amount: Number(data.resource.amount.value),
            },
          };
        default:
          return {
            action: "not_supported",
          };
      }
    } catch (e) {
      console.error("PayPal webhook verification failed:");
      console.error(e);
      const purchaseUnit =
        ("purchase_units" in payload.data.resource &&
          payload.data.resource?.purchase_units?.[0]) ||
        ("custom_id" in payload.data.resource && payload.data.resource) ||
        null;
      return purchaseUnit
        ? {
            action: "failed",
            data: {
              session_id: purchaseUnit.custom_id,
              amount: Number(purchaseUnit.amount.value),
            },
          }
        : {
            action: "failed",
          };
    }
  }

  private checkPaymentStatus(
    status: CaptureStatus,
    processorResponse?: {
      avsCode?: string;
      cvvCode?: string;
      responseCode?: string;
    }
  ): { status: CaptureStatus; error?: PaypalPaymentError } {
    const processorResponseMap: Record<string, PaypalPaymentError> = {
      "0500": {
        code: "0500 - DO_NOT_HONOR",
        message:
          "Card refused by issuer. Please try again or use a different card.",
        retryable: false,
      },
      "9500": {
        code: "9500 - SUSPECTED_FRAUD",
        message:
          "Suspected fraudulent card. Please try again and use a different card.",
        retryable: false,
      },
      "5400": {
        code: "5400 - EXPIRED_CARD",
        message: "Card has expired. Please try again and use a different card.",
        retryable: false,
      },
      "5120": {
        code: "5120 - INSUFFICIENT_FUNDS",
        message:
          "Insufficient funds. Please try again or use a different card.",
        retryable: true,
      },
      "00N7": {
        code: "00N7 - CVV_FAILURE",
        message:
          "Incorrect security code. Please try again or use a different card.",
        retryable: true,
      },
      "1330": {
        code: "1330 - INVALID_ACCOUNT",
        message: "Card not valid. Please try again or use a different card.",
        retryable: true,
      },
      "5100": {
        code: "5100 - GENERIC_DECLINE",
        message: "Card is declined. Please try again or use a different card.",
        retryable: true,
      },
    };

    switch (status) {
      case "COMPLETED":
        return { status };

      case "DECLINED":
        if (processorResponse?.responseCode) {
          const errorDetails = processorResponseMap[
            processorResponse.responseCode
          ] || {
            code: processorResponse.responseCode,
            message:
              "Payment declined. Please try again or use a different card.",
            retryable: false,
          };

          return {
            status,
            error: {
              ...errorDetails,
              avsCode: processorResponse.avsCode,
              cvvCode: processorResponse.cvvCode,
            },
          };
        }

        return {
          status,
          error: {
            code: "DECLINED",
            message:
              "Payment declined. Please try again or use a different card.",
            retryable: false,
          },
        };

      default:
        return {
          status,
          error: {
            code: "UNKNOWN_STATUS",
            message: `Unknown payment status: ${status}. Please try again or use a different card.`,
            retryable: false,
          },
        };
    }
  }
}
