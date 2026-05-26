"use client";

import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface LegalActDeleteButtonProps {
  id: string;
  actNumber: string;
  title: string;
  deleteAction: React.ComponentProps<"form">["action"];
}

export function LegalActDeleteButton({
  id,
  actNumber,
  title,
  deleteAction,
}: LegalActDeleteButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="h-4 w-4" />
          Устгах
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Эрх зүйн актыг устгах уу?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-semibold text-foreground">{actNumber}</span>{" "}
            дугаартай “{title}” эрх зүйн актыг устгах гэж байна. Энэ act
            жагсаалтаас алга болох бөгөөд холбоотой шинэчлэлийн түүх харагдахгүй
            болно.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Болих</AlertDialogCancel>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={id} />
            <DeleteSubmitButton />
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Устгаж байна..." : "Устгах"}
    </Button>
  );
}
