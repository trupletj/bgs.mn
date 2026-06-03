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
  createOrderPurchaseQuote,
  createOrderSupplier,
  getOrderPurchaseQuoteDocumentUrl,
  searchOrderSuppliers,
  type SupplierSearchResult,
} from "@/actions/order-purchases";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_UPLOAD_MAX_BYTES,
  getFileSizeLimitMessage,
  getFileTooLargeMessage,
} from "@/lib/file-upload-limits";
import {
  Building2,
  ClipboardList,
  ExternalLink,
  Plus,
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

function filterAllowedSizeFiles(files: FileList | null) {
  return Array.from(files ?? []).filter((file) => {
    if (file.size <= DOCUMENT_UPLOAD_MAX_BYTES) return true;

    toast.error(getFileTooLargeMessage(file.name, DOCUMENT_UPLOAD_MAX_BYTES));
    return false;
  });
}

export function PurchaseQuoteManager({
  orderId,
  items,
  quotes,
  purchaseBatches,
  onRefresh,
}: {
  orderId: string;
  items: OrderProcessItem[];
  quotes: PurchaseQuoteRow[];
  purchaseBatches: PurchaseBatchRow[];
  onRefresh: () => void;
}) {
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
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
  const [quoteNumber, setQuoteNumber] = useState("");
  const [quoteDate, setQuoteDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [quoteFiles, setQuoteFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(
    new Set(),
  );
  const [lineInputs, setLineInputs] = useState<
    Record<number, PurchaseLineFormInput>
  >({});
  const [saving, setSaving] = useState(false);

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

  const filteredItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) => {
      if (selectedItemIds.has(item.id)) return true;
      return [item.part_name, item.part_number, item.part_description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [itemSearch, items, selectedItemIds]);

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

  const toggleItemSelection = (itemId: number) => {
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
        const item = items.find((currentItem) => currentItem.id === itemId);
        const target = Number(item?.final_quantity ?? item?.quantity ?? 0);
        const purchased = purchasedByItem.get(itemId) ?? 0;
        const remaining = Math.max(0, target - purchased);
        if (remaining <= 0) return next;

        next.add(itemId);
        setLineInputs((current) => ({
          ...current,
          [itemId]: {
            ...buildLineInput(current[itemId], "currency", "MNT"),
            quantity: current[itemId]?.quantity || String(remaining),
          },
        }));
      }
      return next;
    });
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
    if (!selectedSupplier) {
      toast.error("Үнийн санал өгсөн компани сонгоно уу");
      return;
    }

    const lines = items
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

    if (lines.length === 0) {
      toast.error("Үнийн санал авах бараагаа сонгоно уу");
      return;
    }

    const emptyQuantityLine = lines.find((line) => line.quantity <= 0);
    if (emptyQuantityLine) {
      toast.error(`${emptyQuantityLine.itemName} дээр тоо оруулна уу`);
      return;
    }

    const emptyPriceLine = lines.find((line) => line.unitPrice <= 0);
    if (emptyPriceLine) {
      toast.error(`${emptyPriceLine.itemName} дээр нэгж үнэ оруулна уу`);
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
    formData.set("quoteNumber", quoteNumber);
    formData.set("quoteDate", quoteDate);
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
    quoteFiles.forEach((file) => formData.append("quoteFiles", file));

    setSaving(true);
    try {
      const result = await createOrderPurchaseQuote(formData);
      if (!result.success) {
        throw new Error(result.error ?? "Үнийн санал хадгалахад алдаа гарлаа");
      }
      toast.success("Үнийн санал хадгалагдлаа");
      setSelectedSupplier(null);
      setSupplierQuery("");
      setQuoteNumber("");
      setNotes("");
      setQuoteFiles([]);
      setSelectedItemIds(new Set());
      setLineInputs({});
      setQuoteDialogOpen(false);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Үнийн санал</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Авсан үнийн саналуудыг харьцуулж, худалдан авалтын баримт
              бүртгэхдээ modal дотроос сонгоно.
            </p>
          </div>
          <DialogTrigger asChild>
            <Button type="button">
              <Plus className="h-4 w-4" />
              Үнийн санал бүртгэх
            </Button>
          </DialogTrigger>
        </div>

        <PurchaseQuoteList quotes={quotes} />
      </section>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[92vw] lg:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Үнийн санал бүртгэх</DialogTitle>
          <DialogDescription>
            Нийлүүлэгч, үнийн саналын файл болон барааны тоо/үнийг бүртгэнэ.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 pr-2">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
              <label className="text-xs font-medium text-muted-foreground">
                Үнийн санал өгсөн компани
              </label>
              <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Үнийн саналын дугаар
                  </label>
                  <Input
                    value={quoteNumber}
                    onChange={(event) => setQuoteNumber(event.target.value)}
                    placeholder="Дугаар"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Үнийн саналын огноо
                  </label>
                  <Input
                    type="date"
                    value={quoteDate}
                    onChange={(event) => setQuoteDate(event.target.value)}
                  />
                </div>
              </div>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Үнийн саналын тэмдэглэл..."
                className="min-h-20"
              />
            </div>

            <div className="rounded-lg border border-border/60 p-3">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Үнийн саналын файл
              </label>
              <Input
                type="file"
                multiple
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const files = filterAllowedSizeFiles(event.target.files);
                  setQuoteFiles((prev) => [
                    ...prev,
                    ...files,
                  ]);
                  event.currentTarget.value = "";
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {getFileSizeLimitMessage(DOCUMENT_UPLOAD_MAX_BYTES)}
              </p>
              <SelectedFileList
                files={quoteFiles}
                onRemove={(index) =>
                  setQuoteFiles((prev) =>
                    prev.filter((_, fileIndex) => fileIndex !== index),
                  )
                }
              />
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
              <Badge variant="outline">{selectedItemIds.size} сонгосон</Badge>
            </div>

            <ScrollArea className="h-[300px]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-border/60 bg-muted text-xs font-semibold uppercase text-muted-foreground">
                      <th className="px-3 py-2 text-left">Сонгох</th>
                      <th className="px-3 py-2 text-left">Бараа</th>
                      <th className="px-3 py-2 text-left">Үлдэгдэл</th>
                      <th className="px-3 py-2 text-left">Саналын тоо</th>
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
                      const isUnavailable = remaining <= 0;
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
                              disabled={isUnavailable}
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
                            <QuantityStatusBadge
                              target={target}
                              purchased={purchased}
                              remaining={remaining}
                              unit={item.unit}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min="0"
                              max={remaining || undefined}
                              value={line?.quantity ?? ""}
                              disabled={!isSelected || isUnavailable}
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
                              disabled={!isSelected}
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
                              disabled={!isSelected}
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
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="mt-4 ml-auto">
            <Plus className="h-4 w-4" />
            {saving ? "Хадгалж байна..." : "Үнийн санал хадгалах"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseQuoteList({ quotes }: { quotes: PurchaseQuoteRow[] }) {
  if (quotes.length === 0) return null;

  const openDocument = async (documentId: string) => {
    try {
      const url = await getOrderPurchaseQuoteDocumentUrl(documentId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Файл нээхэд алдаа гарлаа",
      );
    }
  };

  return (
    <div className="mt-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Авсан үнийн саналууд</h3>
        <Badge variant="secondary">{quotes.length}</Badge>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {quotes.map((quote) => {
          const totalByCurrency = quote.order_purchase_quote_lines.reduce(
            (acc, line) => {
              const currency = line.currency || "MNT";
              acc[currency] =
                (acc[currency] ?? 0) +
                Number(line.quantity || 0) * Number(line.unit_price || 0);
              return acc;
            },
            {} as Record<string, number>,
          );

          return (
            <div
              key={quote.id}
              className="rounded-lg border border-border/60 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">
                      {quote.order_suppliers?.name ?? "Компани"}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(quote.quote_date)} ·{" "}
                    {quote.quote_number || "Дугааргүй"}
                  </p>
                </div>
              </div>

              <div className="mt-3 overflow-x-auto rounded-md border border-border/50">
                <table className="w-full min-w-[520px] text-xs">
                  <thead>
                    <tr className="bg-muted/60 text-muted-foreground">
                      <th className="px-2 py-2 text-left">Бараа</th>
                      <th className="px-2 py-2 text-right">Тоо</th>
                      <th className="px-2 py-2 text-right">Нэгж үнэ</th>
                      <th className="px-2 py-2 text-right">Нийт</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {quote.order_purchase_quote_lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-2 py-2">
                          <p className="font-medium">
                            {line.order_items?.part_name ?? "Бараа"}
                          </p>
                          {line.order_items?.part_number && (
                            <p className="font-mono text-muted-foreground">
                              {line.order_items.part_number}
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {formatQuantity(line.quantity)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {formatMoney(line.unit_price, line.currency)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {formatMoney(
                            Number(line.quantity || 0) *
                              Number(line.unit_price || 0),
                            line.currency,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(totalByCurrency).map(([currency, total]) => (
                  <Badge key={currency} variant="outline">
                    Нийт {formatMoney(total, currency)}
                  </Badge>
                ))}
                {quote.order_purchase_quote_documents.map((document) => (
                  <Button
                    key={document.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openDocument(document.id)}>
                    <ExternalLink className="h-4 w-4" />
                    <span className="max-w-40 truncate">
                      {document.file_name}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
