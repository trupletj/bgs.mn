// components/orders/sub-order-history-popover.tsx
"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, User } from "lucide-react";
import { SubOrderItem } from "@/types/rate";

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}, ${hour}:${minute}`;
};

interface Props {
  history?: SubOrderItem[];
}
export function SubOrderHistoryPopover({ history }: Props) {
  if (!history || history.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        Өмнөх өөрчлөлт байхгүй
      </span>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className="cursor-pointer hover:bg-primary-600 hover:text-white transition-all ease-in-out">
          Түүх ({history.length})
        </Badge>
      </PopoverTrigger>

      <PopoverContent className="w-lg p-0 rounded-lg shadow-lg bg-white border border-gray-200">
        <ScrollArea className="max-h-full">
          <div className="p-4 space-y-6">
            <label className="font-semibold text-lg text-gray-800">
              Санал болгосон өөрчлөлтүүд:
            </label>

            {history.map((item) => (
              <div
                key={item.id}
                className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors ease-in-out">
                <div className="mt-2 flex items-center justify-between text-xs ">
                  <span className="flex items-center gap-1">
                    <User size={12} />
                    {item.reviewer_profile?.name || "Тодорхойгүй"}
                  </span>

                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatDate(item.created_at)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="font-semibold text-gray-700">
                    Тоо хэмжээ: {item.quantity}
                  </span>
                </div>

                {item.description && (
                  <p className="text-sm text-gray-700 mt-2">
                    {item.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
