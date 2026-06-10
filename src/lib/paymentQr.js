export const DEFAULT_PAYMENT_NOTE_PREFIX = "9ROUTER";

export function getTransferNote(settings, order) {
  const notePrefix = String(settings?.paymentBankNotePrefix || DEFAULT_PAYMENT_NOTE_PREFIX).trim() || DEFAULT_PAYMENT_NOTE_PREFIX;
  return `${notePrefix} ${order.id}`;
}

export function buildSepayQrUrl(settings, order, options = {}) {
  const bankCode = String(settings?.paymentBankCode || "").trim();
  const accountNumber = String(settings?.paymentBankAccountNumber || "").trim();
  if (!bankCode || !accountNumber || !order) return "";

  const params = new URLSearchParams({
    acc: accountNumber,
    bank: bankCode,
    amount: String(Math.round(Number(order.price || 0))),
    des: getTransferNote(settings, order),
  });

  const template = String(options.template || "compact").trim();
  if (template) params.set("template", template);
  if (options.download === true) params.set("download", "true");

  return `https://qr.sepay.vn/img?${params.toString()}`;
}

export function buildPaymentInfo(settings, order) {
  const bankEnabled = settings?.paymentBankEnabled === true || settings?.paymentBankEnabled === 1;
  const bankCode = String(settings?.paymentBankCode || "").trim();
  const accountNumber = String(settings?.paymentBankAccountNumber || "").trim();
  const accountName = String(settings?.paymentBankAccountName || "").trim();
  const transferNote = getTransferNote(settings, order);

  if (!bankEnabled || !bankCode || !accountNumber) {
    return {
      method: "manual",
      enabled: false,
      transferNote,
      message: "Payment QR is not configured. Contact admin to complete payment.",
    };
  }

  return {
    method: "sepay",
    enabled: true,
    bankCode,
    accountNumber,
    accountName,
    transferNote,
    qrUrl: buildSepayQrUrl(settings, order),
  };
}
