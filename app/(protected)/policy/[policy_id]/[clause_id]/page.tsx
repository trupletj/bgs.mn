import ClauseJobConnect from "@/components/policy/ClauseJobConnect";

interface Props {
  params: Promise<{
    policy_id: string;
    clause_id: string;
  }>;
}

export default async function ConnectPage({ params }: Props) {
  const { policy_id, clause_id } = await params;

  return <ClauseJobConnect policy_id={policy_id} clause_id={clause_id} />;
}
