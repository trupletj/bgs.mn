"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createOrderPurchaseBatch,
  createOrderSupplier,
  searchOrderSuppliers,
  type SupplierSearchResult,
} from "@/actions/order-purchases";
import { cn } from "@/lib/utils";
import {
  Building2,
  CheckCircle2,
  Plus,
  ReceiptText,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import type {
  OrderProcessItem,
  PurchaseBatchRow,
  PurchaseQuoteRow,
} from "./types";
import { QuantityStatusBadge } from "./quantity-status-badge";
import { SelectedFileList } from "./selected-file-list";
import {
  CURRENCY_OPTIONS,
  formatDate,
  formatMoney,
  formatQuantity,
} from "./utils";

type PurchaseLineFormInput = {
  quantity: string;
  unitPrice: string;
  currency: string;
  notes: string;
};

function buildLineInput(
  current: PurchaseLineFormInput | undefined,
  field: keyof PurchaseLineFormInput,
  value: string,
): PurchaseLineFormInput {
  const next = current ?? {
    quantity: "",
    unitPrice: "",
    currency: "MNT",
    notes: "",
  };

  return { ...next, [field]: value };
}

export function PurchaseBatchForm({
  orderId,
  items,
  purchaseBatches,
  purchaseQuotes,
  onRefresh,
}: {
  orderId: string;
  items: OrderProcessItem[];
  purchaseBatches: PurchaseBatchRow[];
  purchaseQuotes: PurchaseQuoteRow[];
  onRefresh: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierResults, setSupplierResults] = useState<
    SupplierSearchResult[]
  >([]);
  const [selectedSupplier, setSelectedSupplier] =
    useState<SupplierSearchResult | null>(null);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierRegistration, setNewSupplierRegistration] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [paidAt, setPaidAt] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [paymentFiles, setPaymentFiles] = useState<File[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(
    new Set(),
  );
  const [lineInputs, setLineInputs] = useState<
    Record<number, PurchaseLineFormInput>
  >({});
  const [saving, setSaving] = useState(false);

  const selectedQuote = purchaseQuotes.find(
    (quote) => Number(quote.id) === Number(selectedQuoteId),
  );
  const selectedQuoteItemIds = useMemo(() => {
    return new Set(
      (selectedQuote?.order_purchase_quote_lines ?? []).map((line) =>
        Number(line.order_item_id),
      ),
    );
  }, [selectedQuote]);
  const isQuoteLinkedMode = Boolean(selectedQuote);

  const purchasedByItem = useMemo(() => {
    const totals = new Map<number, number>();
    for (const batch of purchaseBatches) {
      for (const line of batch.order_purchase_lines ?? []) {
        totals.set(
          Number(line.order_item_id),
          (totals.get(Number(line.order_item_id)) ?? 0) +
            Number(line.quantity || 0),
        );
      }
    }
    return totals;
  }, [purchaseBatches]);

  useEffect(() => {
    if (!dialogOpen) return;
    setSelectedQuoteId(purchaseQuotes[0] ? Number(purchaseQuotes[0].id) : null);
    setInvoiceFiles([]);
    setPaymentFiles([]);
  }, [dialogOpen, purchaseQuotes]);

  useEffect(() => {
    if (!selectedQuote?.order_suppliers) {
      setSelectedSupplier(null);
      setSupplierQuery("");
      setReferenceNumber("");
      setSelectedItemIds(new Set());
      setLineInputs({});
      return;
    }

    setSelectedSupplier(selectedQuote.order_suppliers);
    setSupplierQuery(selectedQuote.order_suppliers.name);
    setShowNewSupplier(false);
    setReferenceNumber("");
    const quoteLinesWithRemaining =
      selectedQuote.order_purchase_quote_lines.filter((line) => {
        const item = items.find(
          (currentItem) => currentItem.id === Number(line.order_item_id),
        );
        const target = Number(item?.final_quantity ?? item?.quantity ?? 0);
        const purchased = purchasedByItem.get(Number(line.order_item_id)) ?? 0;
        return Math.max(0, target - purchased) > 0;
      });

    setSelectedItemIds(
      new Set(
        quoteLinesWithRemaining.map((line) => Number(line.order_item_id)),
      ),
    );
    setLineInputs(
      Object.fromEntries(
        quoteLinesWithRemaining.map((line) => [
          Number(line.order_item_id),
          {
            quantity: "",
            unitPrice: String(line.unit_price ?? ""),
            currency: line.currency || "MNT",
            notes: line.notes ?? "",
          },
        ]),
      ),
    );
  }, [items, purchasedByItem, selectedQuote]);

  useEffect(() => {
    let cancelled = false;
    if (supplierQuery.trim().length < 2) {
      setSupplierResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      const results = await searchOrderSuppliers(supplierQuery);
      if (!cancelled) setSupplierResults(results);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [supplierQuery]);

  const selectedItemCount = useMemo(() => {
    return selectedItemIds.size;
  }, [selectedItemIds]);

  const filteredItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) => {
      if (selectedItemIds.has(item.id)) return true;

      return [
        item.part_name,
        item.part_number,
        item.part_description,
        item.manufacturer,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [itemSearch, items, selectedItemIds]);

  const toggleItemSelection = (itemId: number) => {
    if (isQuoteLinkedMode) return;

    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
        setLineInputs((current) => {
          const updated = { ...current };
          delete updated[itemId];
          return updated;
        });
      } else {
        next.add(itemId);
        setLineInputs((current) => ({
          ...current,
          [itemId]: buildLineInput(current[itemId], "currency", "MNT"),
        }));
      }
      return next;
    });
  };

  const setLineValue = (
    itemId: number,
    field: "quantity" | "unitPrice" | "currency" | "notes",
    value: string,
  ) => {
    setLineInputs((prev) => ({
      ...prev,
      [itemId]: buildLineInput(prev[itemId], field, value),
    }));
  };

  const handleCreateSupplier = async () => {
    try {
      const supplier = await createOrderSupplier({
        name: newSupplierName || supplierQuery,
        registrationNumber: newSupplierRegistration,
      });
      setSelectedSupplier(supplier);
      setSupplierQuery(supplier.name);
      setShowNewSupplier(false);
      setNewSupplierName("");
      setNewSupplierRegistration("");
      toast.success("Компани нэмэгдлээ");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Компани нэмэхэд алдаа гарлаа",
      );
    }
  };

  const handleSubmit = async () => {
    if (!selectedQuote) {
      toast.error("Худалдан авалтын баримтад холбох үнийн саналаа сонгоно уу");
      return;
    }
    if (!selectedSupplier) {
      toast.error("Нийлүүлэгч компани сонгоно уу");
      return;
    }
    if (invoiceFiles.length === 0 || paymentFiles.length === 0) {
      toast.error("Нэхэмжлэх болон төлбөрийн баримт заавал хавсаргана");
      return;
    }

    const selectedLines = items
      .filter((item) => selectedItemIds.has(item.id))
      .map((item) => {
        const input = lineInputs[item.id];
        const target = Number(item.final_quantity ?? item.quantity ?? 0);
        const purchased = purchasedByItem.get(item.id) ?? 0;
        const remaining = Math.max(0, target - purchased);
        return {
          orderItemId: item.id,
          itemName: item.part_name,
          itemNumber: item.part_number,
          quantity: Number(input?.quantity ?? 0),
          unitPrice: Number(input?.unitPrice ?? 0),
          currency: input?.currency || "MNT",
          notes: input?.notes || "",
          remaining,
        };
      });

    if (selectedLines.length === 0) {
      toast.error(
        isQuoteLinkedMode
          ? "Сонгосон үнийн саналын бүх бараа бүрэн худалдан авагдсан байна"
          : "Худалдан авах бараагаа сонгоно уу",
      );
      return;
    }

    const negativeQuantityLine = selectedLines.find(
      (line) => line.quantity < 0,
    );
    if (negativeQuantityLine) {
      toast.error(
        `${negativeQuantityLine.itemName}${
          negativeQuantityLine.itemNumber
            ? ` (${negativeQuantityLine.itemNumber})`
            : ""
        } дээр авах тоо 0-ээс бага байж болохгүй`,
      );
      return;
    }

    const lines = selectedLines.filter((line) => line.quantity > 0);
    if (lines.length === 0) {
      toast.error("Дор хаяж нэг бараанд авах тоо оруулна уу");
      return;
    }

    const emptyPriceLine = lines.find((line) => line.unitPrice <= 0);
    if (emptyPriceLine) {
      toast.error(
        `${emptyPriceLine.itemName}${
          emptyPriceLine.itemNumber ? ` (${emptyPriceLine.itemNumber})` : ""
        } дээр нэгж үнэ оруулна уу`,
      );
      return;
    }

    const overRemainingLine = lines.find(
      (line) => line.quantity > line.remaining,
    );
    if (overRemainingLine) {
      toast.error(
        `${overRemainingLine.itemName}${
          overRemainingLine.itemNumber
            ? ` (${overRemainingLine.itemNumber})`
            : ""
        } үлдэгдлээс хэтэрсэн байна. Үлдэгдэл: ${formatQuantity(
          overRemainingLine.remaining,
        )}`,
      );
      return;
    }

    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("supplierId", String(selectedSupplier.id));
    formData.set("quoteId", String(selectedQuote.id));
    formData.set("referenceNumber", referenceNumber);
    formData.set("purchasedAt", purchasedAt);
    formData.set("paidAt", paidAt);
    formData.set("notes", notes);
    formData.set(
      "lines",
      JSON.stringify(
        lines.map(({ orderItemId, quantity, unitPrice, currency, notes }) => ({
          orderItemId,
          quantity,
          unitPrice,
          currency,
          notes,
        })),
      ),
    );
    invoiceFiles.forEach((file) => formData.append("invoices", file));
    paymentFiles.forEach((file) => formData.append("payments", file));

    setSaving(true);
    try {
      const result = await createOrderPurchaseBatch(formData);
      if (!result.success) {
        throw new Error(result.error ?? "Хадгалахад алдаа гарлаа");
      }
      toast.success("Худалдан авалтын багц бүртгэгдлээ");
      setSelectedSupplier(null);
      setSupplierQuery("");
      setReferenceNumber("");
      setPaidAt("");
      setNotes("");
      setInvoiceFiles([]);
      setPaymentFiles([]);
      setSelectedItemIds(new Set());
      setLineInputs({});
      setSelectedQuoteId(null);
      setDialogOpen(false);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Худалдан авалтын баримт</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Сонгосон үнийн саналаас нэхэмжлэх, төлбөрийн баримт бүртгэнэ.
          </p>
        </div>
        <DialogTrigger asChild>
          <Button type="button" disabled={purchaseQuotes.length === 0}>
            <ReceiptText className="h-4 w-4" />
            Худалдан авалтын баримт бүртгэх
          </Button>
        </DialogTrigger>
      </section>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[92vw] lg:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Худалдан авалтын баримт бүртгэх</DialogTitle>
          <DialogDescription>
            Үнийн саналаа сонгоод нэхэмжлэх, төлбөрийн баримт болон авах тоог
            нэг багцад холбоно.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 pr-2">
          <div className="rounded-lg border border-border/60">
            <div className="flex flex-col gap-1 border-b border-border/60 p-3">
              <p className="text-sm font-semibold">Үнийн санал сонгох</p>
              <p className="text-xs text-muted-foreground">
                Сонгосон үнийн саналын компани, бараа, үнэ автоматаар
                бөглөгдөнө.
              </p>
            </div>
            {purchaseQuotes.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                Үнийн санал бүртгэгдээгүй байна.
              </div>
            ) : (
              <div className="grid gap-3 p-3 lg:grid-cols-2">
                {purchaseQuotes.map((quote) => {
                  const selected = Number(quote.id) === Number(selectedQuoteId);
                  const totalByCurrency =
                    quote.order_purchase_quote_lines.reduce(
                      (acc, line) => {
                        const currency = line.currency || "MNT";
                        acc[currency] =
                          (acc[currency] ?? 0) +
                          Number(line.quantity || 0) *
                            Number(line.unit_price || 0);
                        return acc;
                      },
                      {} as Record<string, number>,
                    );

                  return (
                    <button
                      key={quote.id}
                      type="button"
                      onClick={() => {
                        const nextQuoteId = Number(quote.id);
                        if (nextQuoteId !== Number(selectedQuoteId)) {
                          setInvoiceFiles([]);
                          setPaymentFiles([]);
                        }
                        setSelectedQuoteId(nextQuoteId);
                      }}
                      className={cn(
                        "rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/50",
                        selected && "border-primary bg-primary/5",
                      )}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold">
                              {quote.order_suppliers?.name ?? "Компани"}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(quote.quote_date)} ·{" "}
                            {quote.quote_number || "Дугааргүй"}
                          </p>
                        </div>
                        {selected && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {quote.order_purchase_quote_lines.length} бараа
                        </Badge>
                        {Object.entries(totalByCurrency).map(
                          ([currency, total]) => (
                            <Badge key={currency} variant="secondary">
                              {formatMoney(total, currency)}
                            </Badge>
                          ),
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedQuote && (
            <p className="text-sm font-medium text-primary">
              Холбох үнийн санал: {selectedQuote.quote_number || "Дугааргүй"} ·{" "}
              {selectedQuote.order_suppliers?.name}
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
              <label className="text-xs font-medium text-muted-foreground">
                Нийлүүлэгч компани
              </label>
              <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    disabled={isQuoteLinkedMode}
                    className="justify-between">
                    <span className="truncate">
                      {selectedSupplier
                        ? `${selectedSupplier.name}${selectedSupplier.registration_number ? ` · ${selectedSupplier.registration_number}` : ""}`
                        : "Нэр эсвэл РД хайх"}
                    </span>
                    <Search className="h-4 w-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[min(92vw,420px)] p-0"
                  align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      value={supplierQuery}
                      onValueChange={(value) => {
                        setSupplierQuery(value);
                        setSelectedSupplier(null);
                      }}
                      placeholder="Компани эсвэл РД..."
                    />
                    <CommandList>
                      <CommandEmpty>
                        <div className="flex flex-col gap-2 p-2 text-left">
                          <span>Компани олдсонгүй</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowNewSupplier(true);
                              setNewSupplierName(supplierQuery);
                              setSupplierOpen(false);
                            }}>
                            <Plus className="h-4 w-4" />
                            Шинээр нэмэх
                          </Button>
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {supplierResults.map((supplier) => (
                          <CommandItem
                            key={supplier.id}
                            value={String(supplier.id)}
                            onSelect={() => {
                              setSelectedSupplier(supplier);
                              setSupplierQuery(supplier.name);
                              setShowNewSupplier(false);
                              setNewSupplierName("");
                              setNewSupplierRegistration("");
                              setSupplierOpen(false);
                            }}>
                            <Building2 className="h-4 w-4" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {supplier.name}
                              </p>
                              {supplier.registration_number && (
                                <p className="text-xs text-muted-foreground">
                                  РД: {supplier.registration_number}
                                </p>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {showNewSupplier && (
                <div className="rounded-lg border border-dashed border-border p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={newSupplierName}
                      onChange={(event) =>
                        setNewSupplierName(event.target.value)
                      }
                      placeholder="Компанийн нэр"
                    />
                    <Input
                      value={newSupplierRegistration}
                      onChange={(event) =>
                        setNewSupplierRegistration(event.target.value)
                      }
                      placeholder="РД"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2"
                    onClick={handleCreateSupplier}>
                    <Plus className="h-4 w-4" />
                    Компани хадгалах
                  </Button>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Үнийн саналын гарчиг
                </label>
                <Input
                  value={referenceNumber}
                  onChange={(event) => setReferenceNumber(event.target.value)}
                  placeholder="Нэхэмжлэх, гүйлгээ, гэрээ эсвэл дотоод лавлах дугаар"
                />
              </div>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ерөнхий тэмдэглэл..."
                className="min-h-20"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-lg border border-border/60 p-3">
                <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Нэхэмжлэх үүссэн огноо
                    </label>
                    <Input
                      type="date"
                      value={purchasedAt}
                      onChange={(event) => setPurchasedAt(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Нэхэмжлэх файл
                    </label>
                    <Input
                      type="file"
                      multiple
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        setInvoiceFiles((prev) => [
                          ...prev,
                          ...Array.from(event.target.files ?? []),
                        ]);
                        event.currentTarget.value = "";
                      }}
                    />
                    <SelectedFileList
                      files={invoiceFiles}
                      onRemove={(index) =>
                        setInvoiceFiles((prev) =>
                          prev.filter((_, fileIndex) => fileIndex !== index),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Төлбөр төлсөн огноо
                    </label>
                    <Input
                      type="date"
                      value={paidAt}
                      onChange={(event) => setPaidAt(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Төлбөр төлсөн баримт
                    </label>
                    <Input
                      type="file"
                      multiple
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        setPaymentFiles((prev) => [
                          ...prev,
                          ...Array.from(event.target.files ?? []),
                        ]);
                        event.currentTarget.value = "";
                      }}
                    />
                    <SelectedFileList
                      files={paymentFiles}
                      onRemove={(index) =>
                        setPaymentFiles((prev) =>
                          prev.filter((_, fileIndex) => fileIndex !== index),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-border/60">
            <div className="flex flex-col gap-2 border-b border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={itemSearch}
                  onChange={(event) => setItemSearch(event.target.value)}
                  placeholder="Барааны нэр, эдийн дугаараар хайх..."
                  className="h-9 pl-9"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{filteredItems.length} мөр</Badge>
                <Badge variant="outline">{selectedItemCount} сонгосон</Badge>
              </div>
            </div>

            <ScrollArea className="h-[360px]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-border/60 bg-muted text-xs font-semibold uppercase text-muted-foreground">
                      <th className="px-3 py-2 text-left">Сонгох</th>
                      <th className="px-3 py-2 text-left">Бараа</th>
                      <th className="px-3 py-2 text-left">Үлдэгдэл</th>
                      <th className="px-3 py-2 text-left">Авах тоо</th>
                      <th className="px-3 py-2 text-left">Нэгж үнэ</th>
                      <th className="px-3 py-2 text-left">Валют</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredItems.map((item) => {
                      const target = Number(
                        item.final_quantity ?? item.quantity ?? 0,
                      );
                      const purchased = purchasedByItem.get(item.id) ?? 0;
                      const remaining = Math.max(0, target - purchased);
                      const line = lineInputs[item.id];
                      const isSelected = selectedItemIds.has(item.id);
                      const isQuoteItem = selectedQuoteItemIds.has(item.id);
                      const isUnavailable = remaining <= 0;
                      const isSelectionLocked =
                        isQuoteLinkedMode || isUnavailable;
                      const isQuantityLocked = !isSelected || isUnavailable;
                      const isPriceLocked =
                        !isSelected || isUnavailable || isQuoteLinkedMode;
                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            isUnavailable && "bg-muted/20",
                            isSelected && !isUnavailable && "bg-primary/5",
                          )}>
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={isSelected}
                              disabled={isSelectionLocked}
                              aria-label={`${item.part_name} сонгох`}
                              onCheckedChange={() =>
                                toggleItemSelection(item.id)
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-medium">{item.part_name}</p>
                            {item.part_number && (
                              <p className="font-mono text-xs text-muted-foreground">
                                {item.part_number}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex min-w-0 flex-col gap-1">
                              <QuantityStatusBadge
                                target={target}
                                purchased={purchased}
                                remaining={remaining}
                                unit={item.unit}
                              />
                              {isQuoteLinkedMode && !isQuoteItem && (
                                <span className="text-[11px] font-medium text-muted-foreground">
                                  Сонгосон үнийн саналд байхгүй
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min="0"
                              max={remaining || undefined}
                              value={line?.quantity ?? ""}
                              disabled={isQuantityLocked}
                              onChange={(event) =>
                                setLineValue(
                                  item.id,
                                  "quantity",
                                  event.target.value,
                                )
                              }
                              className="h-8 w-28"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min="0"
                              value={line?.unitPrice ?? ""}
                              disabled={isPriceLocked}
                              onChange={(event) =>
                                setLineValue(
                                  item.id,
                                  "unitPrice",
                                  event.target.value,
                                )
                              }
                              className="h-8 w-32"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              value={line?.currency ?? "MNT"}
                              disabled={isPriceLocked}
                              onValueChange={(value) =>
                                setLineValue(item.id, "currency", value)
                              }>
                              <SelectTrigger className="h-8 w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CURRENCY_OPTIONS.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-10 text-center text-sm text-muted-foreground">
                          Хайлтад тохирох бараа олдсонгүй
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={saving || !selectedQuote}
            className="mt-1 ml-auto">
            <Plus className="h-4 w-4" />
            {saving ? "Хадгалж байна..." : "Худалдан авалт хадгалах"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
