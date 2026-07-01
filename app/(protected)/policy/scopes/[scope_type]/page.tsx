import { notFound } from "next/navigation";

import { hasPermission } from "@/actions/rbac";
import {
  getPolicyScopeBrowserGroups,
  isPolicyScopeBrowserType,
} from "@/actions/policy-scope-browser";
import UnauthorizedPage from "@/app/unauthorized/page";
import { PolicyScopeBrowser } from "@/components/policy/policy-scope-browser";

export default async function Page({
  params,
}: {
  params: Promise<{ scope_type: string }>;
}) {
  const { scope_type } = await params;

  if (!isPolicyScopeBrowserType(scope_type)) {
    notFound();
  }

  const isAccess = await hasPermission("policy", "access");
  if (!isAccess) {
    return <UnauthorizedPage />;
  }

  const groups = await getPolicyScopeBrowserGroups(scope_type);

  return <PolicyScopeBrowser groups={groups} type={scope_type} />;
}
