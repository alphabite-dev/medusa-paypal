import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { PostStorePaypalPaymentType } from "./validators";
import { PaypalService } from "@alphabite/medusa-paypal/providers/paypal/paypal-core";
import { AlphabitePaypalPluginOptionsType } from "src/providers/paypal/service";

interface PaymentProvidersProps {
  resolve: string;
  id: string;
  options: AlphabitePaypalPluginOptionsType;
}

const base =
  process.env.PAYPAL_SANDBOX === "true"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

export const POST = async (
  req: MedusaRequest<PostStorePaypalPaymentType>,
  res: MedusaResponse
) => {
  const paymentModule = req.scope.resolve("payment");

  //@ts-ignore
  const paymentProviders = paymentModule.moduleDeclaration
    .providers as PaymentProvidersProps[];

  const paypalProvider = paymentProviders.find(
    (provider) => provider.id === "paypal"
  );

  if (!paypalProvider) {
    return res.status(404).json({ error: "Paypal provider not found" });
  }

  const paypalService = new PaypalService(paypalProvider.options);

  const accessToken = await paypalService.getAccessToken();

  const response = await fetch(`${base}/v1/identity/generate-token`, {
    method: "post",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Accept-Language": "en_US",
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  return res.status(201).json({ client_token: data.client_token });
};
