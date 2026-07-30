export type PesapalNotificationPayload = {
  OrderNotificationType?: string | null;
  OrderTrackingId?: string | null;
  OrderMerchantReference?: string | null;
};

export type PesapalIpnAckStatus = 200 | 500;

export function buildPesapalIpnAck(
  payload: PesapalNotificationPayload,
  status: PesapalIpnAckStatus
) {
  return {
    orderNotificationType: payload.OrderNotificationType?.trim() || "IPNCHANGE",
    orderTrackingId: payload.OrderTrackingId?.trim() || "",
    orderMerchantReference: payload.OrderMerchantReference?.trim() || "",
    status
  };
}
