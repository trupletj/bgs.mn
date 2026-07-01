"use client";

import { IconLogout } from "@tabler/icons-react";

export function LogoutButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2"
      onClick={onClick}>
      <IconLogout className="h-4 w-4" />
      Системээс гарах
    </button>
  );
}
