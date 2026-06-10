"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Card, Button, Select, Input } from "@/shared/components";
import { buildSepayQrUrl, getTransferNote } from "@/lib/paymentQr";

const DEFAULT_PAYMENT_SETTINGS = {
  paymentBankEnabled: false,
  paymentBankCode: "",
  paymentBankAccountNumber: "",
  paymentBankAccountName: "",
  paymentBankNotePrefix: "9ROUTER",
};

export default function BuyTokensPage() {
  const [packages, setPackages] = useState([]);
  const [keys, setKeys] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [actingOrderId, setActingOrderId] = useState(null);
  const [paymentSettings, setPaymentSettings] = useState(DEFAULT_PAYMENT_SETTINGS);
  const [savingPayment, setSavingPayment] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pkgRes, keyRes, orderRes, paymentRes] = await Promise.all([
        fetch("/api/token-packages", { cache: "no-store" }),
        fetch("/api/keys", { cache: "no-store" }),
        fetch("/api/token-orders", { cache: "no-store" }),
        fetch("/api/payment-settings", { cache: "no-store" }),
      ]);
      const pkgData = await pkgRes.json();
      const keyData = await keyRes.json();
      const orderData = await orderRes.json();
      const paymentData = await paymentRes.json();
      if (pkgRes.ok) setPackages(pkgData.packages || []);
      if (orderRes.ok) setOrders(orderData.orders || []);
      if (paymentRes.ok) setPaymentSettings({ ...DEFAULT_PAYMENT_SETTINGS, ...paymentData });
      if (keyRes.ok) {
        const keyList = keyData.keys || [];
        setKeys(keyList);
        if (keyList[0]?.id) setSelectedKey((prev) => prev || keyList[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadData, 0);
    return () => clearTimeout(timer);
  }, []);

  const buy = async (pkg) => {
    if (!selectedKey) return;
    const createRes = await fetch("/api/token-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKeyId: selectedKey, packageId: pkg.id, paymentMethod: "sepay" }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) return alert(createData.error || "Create order failed");
    setCurrentOrder(createData.order);
    await loadData();
  };

  const savePaymentSettings = async () => {
    setSavingPayment(true);
    try {
      const res = await fetch("/api/payment-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentSettings),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || "Save payment settings failed");
      setPaymentSettings({ ...DEFAULT_PAYMENT_SETTINGS, ...data });
      alert("Đã lưu cấu hình ngân hàng");
    } finally {
      setSavingPayment(false);
    }
  };

  const keyById = useMemo(() => new Map(keys.map((key) => [key.id, key])), [keys]);
  const qrUrl = buildSepayQrUrl(paymentSettings, currentOrder);
  const transferNote = currentOrder ? getTransferNote(paymentSettings, currentOrder) : "";

  const completeOrder = async (order) => {
    setActingOrderId(order.id);
    try {
      const res = await fetch(`/api/token-orders/${order.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentReceived: true, paymentData: { source: "admin-orders-ui", method: order.paymentMethod || "sepay", confirmedAt: new Date().toISOString() } }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || "Complete order failed");
      alert(data.message || `Granted ${Number(data.grantedTokens || 0).toLocaleString()} tokens`);
      if (currentOrder?.id === order.id) setCurrentOrder(null);
      await loadData();
    } finally {
      setActingOrderId(null);
    }
  };

  const revokeOrder = async (order) => {
    if (!window.confirm(`Mark order ${order.id} as failed and remove ${Number(order.tokenAmount || 0).toLocaleString()} purchased tokens?`)) return;
    setActingOrderId(order.id);
    try {
      const res = await fetch(`/api/token-orders/${order.id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "admin-order-error" }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || "Revoke order failed");
      alert(data.message || `Revoked ${Number(data.revokedTokens || 0).toLocaleString()} tokens`);
      await loadData();
    } finally {
      setActingOrderId(null);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0">
      <div>
        <h1 className="text-2xl font-semibold">Buy Extra Tokens</h1>
        <p className="text-sm text-text-muted mt-1">Mua thêm token cho API key khi hết quota</p>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Cấu hình thanh toán SePay QR</h2>
            <p className="text-sm text-text-muted">Nhập mã ngân hàng/short name, số tài khoản, tên chủ tài khoản để tự tạo QR theo gói token.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!paymentSettings.paymentBankEnabled} onChange={(event) => setPaymentSettings((prev) => ({ ...prev, paymentBankEnabled: event.target.checked }))} />
            Bật SePay QR
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Mã ngân hàng / Short name" value={paymentSettings.paymentBankCode} placeholder="vd: MB, VCB, ACB" onChange={(event) => setPaymentSettings((prev) => ({ ...prev, paymentBankCode: event.target.value }))} />
          <Input label="Số tài khoản" value={paymentSettings.paymentBankAccountNumber} onChange={(event) => setPaymentSettings((prev) => ({ ...prev, paymentBankAccountNumber: event.target.value }))} />
          <Input label="Tên chủ tài khoản" value={paymentSettings.paymentBankAccountName} onChange={(event) => setPaymentSettings((prev) => ({ ...prev, paymentBankAccountName: event.target.value.toUpperCase() }))} />
          <Input label="Tiền tố nội dung" value={paymentSettings.paymentBankNotePrefix} placeholder="9ROUTER" onChange={(event) => setPaymentSettings((prev) => ({ ...prev, paymentBankNotePrefix: event.target.value }))} />
        </div>
        <div className="mt-4">
          <Button onClick={savePaymentSettings} loading={savingPayment}>Lưu cấu hình</Button>
        </div>
      </Card>

      <Card>
        <div className="max-w-md">
          <Select
            label="API Key"
            value={selectedKey}
            onChange={setSelectedKey}
            options={keys.map((k) => ({ value: k.id, label: `${k.name} (${Number(k.usedTokens || 0)}/${Number(k.tokenLimit || 0)})` }))}
          />
        </div>
      </Card>

      {currentOrder ? (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5 items-start">
            <div className="rounded-xl bg-white p-3">
              {qrUrl ? <Image src={qrUrl} alt="SePay payment QR code" width={216} height={216} unoptimized className="w-full h-auto" /> : <div className="aspect-square grid place-items-center text-center text-sm text-slate-500">Chưa đủ cấu hình SePay QR</div>}
            </div>
            <div className="space-y-2 text-sm">
              <h2 className="text-lg font-semibold">Quét QR để chuyển khoản</h2>
              <p><span className="font-medium">Order:</span> <span className="font-mono">{currentOrder.id}</span></p>
              <p><span className="font-medium">Gói:</span> {currentOrder.packageName}</p>
              <p><span className="font-medium">Số tiền:</span> {Number(currentOrder.price || 0).toLocaleString()} {currentOrder.currency || "VND"}</p>
              <p><span className="font-medium">Nội dung:</span> {transferNote}</p>
              <p className="text-text-muted">Sau khi nhận tiền, bấm Complete ở bảng order để cộng token vào API key.</p>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? <Card><p className="text-sm text-text-muted">Loading...</p></Card> : packages.map((pkg) => (
          <Card key={pkg.id}>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">{pkg.name}</h3>
              <p className="text-sm text-text-muted">{pkg.description || "Token package"}</p>
              <p className="text-sm"><span className="font-medium">{Number(pkg.tokenAmount || 0).toLocaleString()}</span> tokens</p>
              <p className="text-sm"><span className="font-medium">{Number(pkg.price || 0).toLocaleString()} {pkg.currency || "VND"}</span></p>
              <Button onClick={() => buy(pkg)} disabled={!selectedKey}>Tạo QR thanh toán</Button>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Token Orders</h2>
            <p className="text-sm text-text-muted">Quản lý đơn mua thêm, hoàn tất đơn pending, hoặc gỡ token khi order lỗi.</p>
          </div>
          <Button variant="ghost" icon="refresh" onClick={loadData}>Refresh</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-text-muted">
              <tr className="border-b border-border-subtle">
                <th className="py-2 pr-4">Order</th>
                <th className="py-2 pr-4">API Key</th>
                <th className="py-2 pr-4">Package</th>
                <th className="py-2 pr-4">Tokens</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Method</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={9} className="py-6 text-center text-text-muted">No orders yet</td></tr>
              ) : orders.map((order) => {
                const key = keyById.get(order.apiKeyId);
                const completed = order.status === "completed" || order.status === "success";
                const failed = order.status === "failed" || order.status === "cancelled" || order.status === "refunded";
                return (
                  <tr key={order.id} className="border-b border-border-subtle last:border-b-0">
                    <td className="py-3 pr-4 font-mono text-xs">{order.id}</td>
                    <td className="py-3 pr-4">{key?.name || order.apiKeyId}</td>
                    <td className="py-3 pr-4">{order.packageName}</td>
                    <td className="py-3 pr-4">{Number(order.tokenAmount || 0).toLocaleString()}</td>
                    <td className="py-3 pr-4">{Number(order.price || 0).toLocaleString()} {order.currency || "VND"}</td>
                    <td className="py-3 pr-4">{order.paymentMethod || "-"}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2 py-1 text-xs ${completed ? "bg-green-500/10 text-green-600" : failed ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600"}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-text-muted">{order.createdAt ? new Date(order.createdAt).toLocaleString() : "-"}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {!completed && !failed ? (
                          <Button size="sm" onClick={() => completeOrder(order)} disabled={actingOrderId === order.id}>Complete</Button>
                        ) : null}
                        {completed ? (
                          <Button size="sm" variant="danger" onClick={() => revokeOrder(order)} disabled={actingOrderId === order.id}>Revoke tokens</Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
